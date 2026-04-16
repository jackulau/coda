// LSP stdio transport — framed JSON-RPC over a stdin/stdout pair.
//
// The LSP wire format is:
//
//   Content-Length: <N>\r\n
//   \r\n
//   <N bytes of JSON>
//
// A reader may deliver these in any chunking, including multiple headers in one
// read or a body split across reads. The transport buffers until a full message
// is available, decodes it, dispatches to the matching request (by id) or to a
// notification handler.

export interface Writable {
  write(data: Uint8Array | string): void
  end?(): void
}

export interface Readable {
  on(event: "data", handler: (chunk: Uint8Array | Buffer) => void): void
  on(event: "close", handler: () => void): void
  on(event: "error", handler: (err: Error) => void): void
}

export interface JsonRpcMessage {
  jsonrpc: "2.0"
  id?: number | string
  method?: string
  params?: unknown
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export interface TransportOptions {
  stdin: Writable
  stdout: Readable
  stderr?: Readable
  requestTimeoutMs?: number
}

export class LspTransportClosedError extends Error {
  constructor() {
    super("LSP transport closed before response")
    this.name = "LspTransportClosedError"
  }
}

export class LspRequestTimeoutError extends Error {
  constructor(method: string, id: number | string) {
    super(`LSP request ${method} (id=${id}) timed out`)
    this.name = "LspRequestTimeoutError"
  }
}

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (err: Error) => void
  timeout: ReturnType<typeof setTimeout> | null
  method: string
}

export class StdioTransport {
  private readonly stdin: Writable
  private readonly stdout: Readable
  private readonly requestTimeoutMs: number

  private buffer = new Uint8Array(0)
  private nextId = 1
  private pending = new Map<number | string, PendingRequest>()
  private notificationHandlers = new Map<string, Set<(params: unknown) => void>>()
  private closed = false

  constructor(opts: TransportOptions) {
    this.stdin = opts.stdin
    this.stdout = opts.stdout
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 30_000

    this.stdout.on("data", (chunk) => this.onChunk(chunk))
    this.stdout.on("close", () => this.onClose())
    this.stdout.on("error", () => this.onClose())
  }

  sendRequest<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.closed) return Promise.reject(new LspTransportClosedError())
    const id = this.nextId++
    const msg: JsonRpcMessage = { jsonrpc: "2.0", id, method, params }
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new LspRequestTimeoutError(method, id))
      }, this.requestTimeoutMs)
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timeout,
        method,
      })
      this.write(msg)
    })
  }

  sendNotification(method: string, params?: unknown): void {
    if (this.closed) return
    const msg: JsonRpcMessage = { jsonrpc: "2.0", method, params }
    this.write(msg)
  }

  onNotification(method: string, handler: (params: unknown) => void): () => void {
    let set = this.notificationHandlers.get(method)
    if (!set) {
      set = new Set()
      this.notificationHandlers.set(method, set)
    }
    set.add(handler)
    return () => set?.delete(handler)
  }

  close(): void {
    this.onClose()
  }

  isClosed(): boolean {
    return this.closed
  }

  private write(msg: JsonRpcMessage): void {
    const body = JSON.stringify(msg)
    const byteLength = new TextEncoder().encode(body).byteLength
    const header = `Content-Length: ${byteLength}\r\n\r\n`
    this.stdin.write(header + body)
  }

  private onChunk(chunk: Uint8Array | Buffer): void {
    const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk)
    const next = new Uint8Array(this.buffer.length + bytes.length)
    next.set(this.buffer)
    next.set(bytes, this.buffer.length)
    this.buffer = next
    this.drainMessages()
  }

  private drainMessages(): void {
    while (true) {
      const headerEnd = indexOfHeader(this.buffer)
      if (headerEnd < 0) return
      const headerStr = new TextDecoder("utf-8").decode(this.buffer.subarray(0, headerEnd))
      const length = parseContentLength(headerStr)
      if (length === null) {
        // malformed header — drop everything up to this point and continue
        this.buffer = this.buffer.subarray(headerEnd + 4)
        continue
      }
      const bodyStart = headerEnd + 4
      const bodyEnd = bodyStart + length
      if (this.buffer.length < bodyEnd) return
      const bodyBytes = this.buffer.subarray(bodyStart, bodyEnd)
      this.buffer = this.buffer.subarray(bodyEnd)
      try {
        const body = new TextDecoder("utf-8").decode(bodyBytes)
        const msg = JSON.parse(body) as JsonRpcMessage
        this.dispatch(msg)
      } catch {
        // malformed body — continue, future messages may still decode
      }
    }
  }

  private dispatch(msg: JsonRpcMessage): void {
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const p = this.pending.get(msg.id)
      if (!p) return
      this.pending.delete(msg.id)
      if (p.timeout) clearTimeout(p.timeout)
      if (msg.error) {
        p.reject(new Error(`LSP error: ${msg.error.code} ${msg.error.message}`))
      } else {
        p.resolve(msg.result)
      }
      return
    }
    if (msg.method !== undefined && msg.id === undefined) {
      const set = this.notificationHandlers.get(msg.method)
      if (!set) return
      for (const handler of set) {
        try {
          handler(msg.params)
        } catch {
          // handler errors must not kill the transport
        }
      }
    }
  }

  private onClose(): void {
    if (this.closed) return
    this.closed = true
    const err = new LspTransportClosedError()
    for (const [, p] of this.pending) {
      if (p.timeout) clearTimeout(p.timeout)
      p.reject(err)
    }
    this.pending.clear()
  }
}

function indexOfHeader(buf: Uint8Array): number {
  // look for \r\n\r\n
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a && buf[i + 2] === 0x0d && buf[i + 3] === 0x0a) {
      return i
    }
  }
  return -1
}

function parseContentLength(headerStr: string): number | null {
  for (const line of headerStr.split(/\r?\n/)) {
    const m = line.match(/^Content-Length:\s*(\d+)\s*$/i)
    if (m?.[1]) {
      const n = Number.parseInt(m[1], 10)
      return Number.isFinite(n) && n >= 0 ? n : null
    }
  }
  return null
}
