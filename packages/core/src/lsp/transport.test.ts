import { describe, expect, test } from "bun:test"
import { LspRequestTimeoutError, LspTransportClosedError, StdioTransport } from "./transport"

class MockWritable {
  public chunks: string[] = []
  write(data: Uint8Array | string) {
    this.chunks.push(typeof data === "string" ? data : new TextDecoder().decode(data))
  }
}

class MockReadable {
  private dataHandlers: Array<(c: Uint8Array) => void> = []
  private closeHandlers: Array<() => void> = []
  private errorHandlers: Array<(e: Error) => void> = []
  on(event: "data" | "close" | "error", handler: (...args: never[]) => void): void {
    if (event === "data") this.dataHandlers.push(handler as never)
    else if (event === "close") this.closeHandlers.push(handler as never)
    else if (event === "error") this.errorHandlers.push(handler as never)
  }
  emit(data: string | Uint8Array): void {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data
    for (const h of this.dataHandlers) h(bytes)
  }
  emitClose(): void {
    for (const h of this.closeHandlers) h()
  }
}

function framed(body: unknown): string {
  const json = JSON.stringify(body)
  return `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`
}

function parseFrame(chunk: string): unknown {
  const idx = chunk.indexOf("\r\n\r\n")
  return JSON.parse(chunk.slice(idx + 4))
}

describe("StdioTransport", () => {
  test("writes a request with correct Content-Length framing", () => {
    const stdin = new MockWritable()
    const stdout = new MockReadable()
    const t = new StdioTransport({ stdin, stdout })
    t.sendRequest("initialize", { foo: 1 })
    expect(stdin.chunks).toHaveLength(1)
    const chunk = stdin.chunks[0] ?? ""
    expect(chunk).toMatch(/^Content-Length: \d+\r\n\r\n/)
    const body = parseFrame(chunk) as Record<string, unknown>
    expect(body.jsonrpc).toBe("2.0")
    expect(body.id).toBe(1)
    expect(body.method).toBe("initialize")
    expect(body.params).toEqual({ foo: 1 })
  })

  test("matches a response to its request by id", async () => {
    const stdin = new MockWritable()
    const stdout = new MockReadable()
    const t = new StdioTransport({ stdin, stdout })
    const promise = t.sendRequest<{ hello: string }>("initialize")
    stdout.emit(framed({ jsonrpc: "2.0", id: 1, result: { hello: "world" } }))
    await expect(promise).resolves.toEqual({ hello: "world" })
  })

  test("rejects on LSP error response", async () => {
    const stdin = new MockWritable()
    const stdout = new MockReadable()
    const t = new StdioTransport({ stdin, stdout })
    const promise = t.sendRequest("initialize")
    stdout.emit(
      framed({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "Method not found" } }),
    )
    await expect(promise).rejects.toThrow(/-32601/)
  })

  test("routes notifications to handlers", async () => {
    const stdin = new MockWritable()
    const stdout = new MockReadable()
    const t = new StdioTransport({ stdin, stdout })
    const received: unknown[] = []
    t.onNotification("textDocument/publishDiagnostics", (p) => received.push(p))
    stdout.emit(
      framed({
        jsonrpc: "2.0",
        method: "textDocument/publishDiagnostics",
        params: { uri: "file:///a.ts", diagnostics: [] },
      }),
    )
    expect(received).toHaveLength(1)
    expect((received[0] as { uri: string }).uri).toBe("file:///a.ts")
  })

  test("removes notification handlers on unsubscribe", () => {
    const stdout = new MockReadable()
    const t = new StdioTransport({ stdin: new MockWritable(), stdout })
    const received: unknown[] = []
    const dispose = t.onNotification("ping", (p) => received.push(p))
    stdout.emit(framed({ jsonrpc: "2.0", method: "ping", params: 1 }))
    dispose()
    stdout.emit(framed({ jsonrpc: "2.0", method: "ping", params: 2 }))
    expect(received).toEqual([1])
  })

  test("handles a message split across multiple data events", async () => {
    const stdout = new MockReadable()
    const t = new StdioTransport({ stdin: new MockWritable(), stdout })
    const promise = t.sendRequest("ping")
    const frame = framed({ jsonrpc: "2.0", id: 1, result: "ok" })
    const mid = Math.floor(frame.length / 2)
    stdout.emit(frame.slice(0, mid))
    stdout.emit(frame.slice(mid))
    await expect(promise).resolves.toBe("ok")
  })

  test("handles two messages packed into a single read", async () => {
    const stdout = new MockReadable()
    const t = new StdioTransport({ stdin: new MockWritable(), stdout })
    const notes: unknown[] = []
    t.onNotification("x", (p) => notes.push(p))
    const p1 = t.sendRequest("a")
    const packed =
      framed({ jsonrpc: "2.0", id: 1, result: "A" }) +
      framed({ jsonrpc: "2.0", method: "x", params: 42 })
    stdout.emit(packed)
    await expect(p1).resolves.toBe("A")
    expect(notes).toEqual([42])
  })

  test("sendNotification writes without an id", () => {
    const stdin = new MockWritable()
    const t = new StdioTransport({ stdin, stdout: new MockReadable() })
    t.sendNotification("initialized")
    const body = parseFrame(stdin.chunks[0] ?? "") as Record<string, unknown>
    expect(body.id).toBeUndefined()
    expect(body.method).toBe("initialized")
  })

  test("close rejects all pending requests", async () => {
    const stdout = new MockReadable()
    const t = new StdioTransport({ stdin: new MockWritable(), stdout })
    const p = t.sendRequest("initialize")
    stdout.emitClose()
    await expect(p).rejects.toBeInstanceOf(LspTransportClosedError)
    expect(t.isClosed()).toBe(true)
  })

  test("timeout rejects a request that never gets a response", async () => {
    const stdout = new MockReadable()
    const t = new StdioTransport({
      stdin: new MockWritable(),
      stdout,
      requestTimeoutMs: 50,
    })
    const p = t.sendRequest("slow")
    await expect(p).rejects.toBeInstanceOf(LspRequestTimeoutError)
  })

  test("ignores malformed JSON bodies without dying", async () => {
    const stdout = new MockReadable()
    const t = new StdioTransport({ stdin: new MockWritable(), stdout })
    const p = t.sendRequest("ping")
    // bad frame followed by a good one
    stdout.emit("Content-Length: 9\r\n\r\n{notjson}")
    stdout.emit(framed({ jsonrpc: "2.0", id: 1, result: "ok" }))
    await expect(p).resolves.toBe("ok")
  })
})
