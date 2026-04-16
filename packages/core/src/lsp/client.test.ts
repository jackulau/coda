import { describe, expect, test } from "bun:test"
import { LspClient } from "./client"
import { StdioTransport } from "./transport"

class MockWritable {
  public chunks: string[] = []
  write(data: Uint8Array | string) {
    this.chunks.push(typeof data === "string" ? data : new TextDecoder().decode(data))
  }
}

class MockReadable {
  private data: Array<(c: Uint8Array) => void> = []
  private close: Array<() => void> = []
  private err: Array<(e: Error) => void> = []
  on(event: "data" | "close" | "error", handler: (...a: never[]) => void): void {
    if (event === "data") this.data.push(handler as never)
    else if (event === "close") this.close.push(handler as never)
    else if (event === "error") this.err.push(handler as never)
  }
  emit(data: string): void {
    const bytes = new TextEncoder().encode(data)
    for (const h of this.data) h(bytes)
  }
  emitClose(): void {
    for (const h of this.close) h()
  }
}

function framed(body: unknown): string {
  const json = JSON.stringify(body)
  return `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`
}

function parseBody(chunk: string): Record<string, unknown> {
  const idx = chunk.indexOf("\r\n\r\n")
  return JSON.parse(chunk.slice(idx + 4))
}

function makePair(): { stdin: MockWritable; stdout: MockReadable } {
  return { stdin: new MockWritable(), stdout: new MockReadable() }
}

describe("LspClient", () => {
  test("starts: sends initialize, stores capabilities, sends initialized, transitions to running", async () => {
    const { stdin, stdout } = makePair()
    const transport = new StdioTransport({ stdin, stdout })
    const client = new LspClient({
      transport,
      initializeParams: {
        capabilities: {},
        clientInfo: { name: "coda" },
      },
    })

    expect(client.state).toBe("starting")
    const startPromise = client.start()

    // Respond to the initialize
    stdout.emit(framed({
      jsonrpc: "2.0",
      id: 1,
      result: {
        capabilities: { hoverProvider: true, completionProvider: {} },
        serverInfo: { name: "mock-ls", version: "1.0" },
      },
    }))
    await startPromise

    expect(client.state).toBe("running")
    expect(client.capabilities?.hoverProvider).toBe(true)
    expect(client.serverInfo?.name).toBe("mock-ls")
    expect(client.supports("hoverProvider")).toBe(true)
    expect(client.supports("completionProvider")).toBe(true)
    expect(client.supports("definitionProvider")).toBe(false)

    // Should have written initialize + initialized
    expect(stdin.chunks.length).toBe(2)
    expect((parseBody(stdin.chunks[0]) as { method: string }).method).toBe("initialize")
    expect((parseBody(stdin.chunks[1]) as { method: string }).method).toBe("initialized")
  })

  test("retries initialize on transient failure", async () => {
    const { stdin, stdout } = makePair()
    const transport = new StdioTransport({ stdin, stdout, requestTimeoutMs: 100 })
    const client = new LspClient({
      transport,
      initializeParams: { capabilities: {} },
      initializeRetries: 3,
      initializeBackoffMs: 50,
    })

    const startPromise = client.start()

    // Let the first attempt time out (100ms timeout + 50ms backoff), then
    // the second attempt is in flight for up to 100ms. Respond at 200ms
    // to the active (second) initialize request.
    await new Promise((r) => setTimeout(r, 200))
    const activeInit = stdin.chunks.filter(
      (c) => (parseBody(c) as { method?: string }).method === "initialize",
    )
    expect(activeInit.length).toBeGreaterThanOrEqual(2)
    const lastId = (parseBody(activeInit.at(-1) as string) as { id: number }).id
    stdout.emit(framed({
      jsonrpc: "2.0",
      id: lastId,
      result: { capabilities: {} },
    }))
    await startPromise

    expect(client.state).toBe("running")
  })

  test("start rejects after exhausting retries", async () => {
    const { stdin, stdout } = makePair()
    const transport = new StdioTransport({ stdin, stdout, requestTimeoutMs: 30 })
    const client = new LspClient({
      transport,
      initializeParams: { capabilities: {} },
      initializeRetries: 1,
      initializeBackoffMs: 10,
    })
    await expect(client.start()).rejects.toBeDefined()
    expect(client.state).toBe("stopped")
  })

  test("sendRequest/sendNotification throw when not running", async () => {
    const { stdin, stdout } = makePair()
    const transport = new StdioTransport({ stdin, stdout })
    const client = new LspClient({
      transport,
      initializeParams: { capabilities: {} },
    })
    expect(() => client.sendNotification("ping")).toThrow()
    await expect(client.sendRequest("ping")).rejects.toThrow()
  })

  test("stop sends shutdown + exit and transitions to stopped", async () => {
    const { stdin, stdout } = makePair()
    const transport = new StdioTransport({ stdin, stdout })
    const client = new LspClient({
      transport,
      initializeParams: { capabilities: {} },
    })
    const startPromise = client.start()
    stdout.emit(framed({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } }))
    await startPromise

    const stopPromise = client.stop()
    // Respond to shutdown request
    // shutdown id should be 2
    stdout.emit(framed({ jsonrpc: "2.0", id: 2, result: null }))
    await stopPromise

    expect(client.state).toBe("stopped")
    // should have written shutdown then exit
    const methods = stdin.chunks.map(
      (c) => (parseBody(c) as { method?: string }).method,
    )
    expect(methods).toContain("shutdown")
    expect(methods).toContain("exit")
  })

  test("stop kills process on shutdown timeout", async () => {
    const { stdin, stdout } = makePair()
    const transport = new StdioTransport({ stdin, stdout })
    let killed = false
    const client = new LspClient({
      transport,
      initializeParams: { capabilities: {} },
      onKillProcess: () => {
        killed = true
      },
      shutdownTimeoutMs: 30,
    })
    const startPromise = client.start()
    stdout.emit(framed({ jsonrpc: "2.0", id: 1, result: { capabilities: {} } }))
    await startPromise

    // Don't respond to shutdown → times out → should call onKillProcess
    await client.stop()
    expect(killed).toBe(true)
    expect(client.state).toBe("stopped")
  })

  test("onNotification forwards to the underlying transport", async () => {
    const { stdin, stdout } = makePair()
    const transport = new StdioTransport({ stdin, stdout })
    const client = new LspClient({
      transport,
      initializeParams: { capabilities: {} },
    })
    const received: unknown[] = []
    client.onNotification("textDocument/publishDiagnostics", (p) => received.push(p))
    stdout.emit(framed({
      jsonrpc: "2.0",
      method: "textDocument/publishDiagnostics",
      params: { uri: "file:///a.ts" },
    }))
    expect(received).toHaveLength(1)
  })
})
