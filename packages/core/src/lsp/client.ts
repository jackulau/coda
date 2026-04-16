// High-level LSP client: owns a StdioTransport, handles the initialize →
// initialized → running → stopping state machine, and tracks the server's
// advertised capabilities so callers can gate features on what the server
// actually supports.

import { LspRequestTimeoutError, LspTransportClosedError, type StdioTransport } from "./transport"

export type LspClientState = "starting" | "initialized" | "running" | "stopping" | "stopped"

export interface ServerCapabilities {
  textDocumentSync?: unknown
  completionProvider?: unknown
  hoverProvider?: boolean | Record<string, unknown>
  definitionProvider?: boolean | Record<string, unknown>
  signatureHelpProvider?: unknown
  documentFormattingProvider?: boolean
  renameProvider?: boolean | Record<string, unknown>
  codeActionProvider?: boolean | Record<string, unknown>
  [key: string]: unknown
}

export interface InitializeParams {
  processId?: number | null
  rootUri?: string | null
  workspaceFolders?: Array<{ uri: string; name: string }> | null
  capabilities: Record<string, unknown>
  clientInfo?: { name: string; version?: string }
  locale?: string
}

export interface InitializeResult {
  capabilities: ServerCapabilities
  serverInfo?: { name: string; version?: string }
}

export interface LspClientOptions {
  transport: StdioTransport
  initializeParams: InitializeParams
  /** Soft-kill process reference — used on stop() timeout */
  onKillProcess?: () => void
  /** Max time to wait for shutdown before killing the process */
  shutdownTimeoutMs?: number
  /** Initialize retry config */
  initializeRetries?: number
  initializeBackoffMs?: number
}

export class LspClient {
  private readonly transport: StdioTransport
  private readonly initParams: InitializeParams
  private readonly onKillProcess?: () => void
  private readonly shutdownTimeoutMs: number
  private readonly initRetries: number
  private readonly initBackoffMs: number

  private _state: LspClientState = "starting"
  private _capabilities: ServerCapabilities | null = null
  private _serverInfo: InitializeResult["serverInfo"] | null = null

  constructor(opts: LspClientOptions) {
    this.transport = opts.transport
    this.initParams = opts.initializeParams
    this.onKillProcess = opts.onKillProcess
    this.shutdownTimeoutMs = opts.shutdownTimeoutMs ?? 3_000
    this.initRetries = opts.initializeRetries ?? 3
    this.initBackoffMs = opts.initializeBackoffMs ?? 200
  }

  get state(): LspClientState {
    return this._state
  }

  get capabilities(): ServerCapabilities | null {
    return this._capabilities
  }

  get serverInfo(): InitializeResult["serverInfo"] | null {
    return this._serverInfo
  }

  supports(feature: keyof ServerCapabilities): boolean {
    const v = this._capabilities?.[feature]
    if (v === undefined || v === null) return false
    if (typeof v === "boolean") return v
    return true
  }

  async start(): Promise<void> {
    if (this._state !== "starting") {
      throw new Error(`LspClient.start called in state ${this._state}`)
    }

    let lastErr: unknown
    for (let attempt = 0; attempt <= this.initRetries; attempt++) {
      try {
        const result = (await this.transport.sendRequest<InitializeResult>(
          "initialize",
          this.initParams,
        )) as InitializeResult
        this._capabilities = result.capabilities ?? {}
        this._serverInfo = result.serverInfo ?? null
        this._state = "initialized"
        this.transport.sendNotification("initialized", {})
        this._state = "running"
        return
      } catch (err) {
        lastErr = err
        if (err instanceof LspTransportClosedError) break
        if (attempt < this.initRetries) {
          await delay(this.initBackoffMs * 2 ** attempt)
        }
      }
    }
    this._state = "stopped"
    throw lastErr instanceof Error ? lastErr : new Error("LspClient.start failed")
  }

  async sendRequest<T = unknown>(method: string, params?: unknown): Promise<T> {
    this.assertRunning(method)
    return this.transport.sendRequest<T>(method, params)
  }

  sendNotification(method: string, params?: unknown): void {
    this.assertRunning(method)
    this.transport.sendNotification(method, params)
  }

  onNotification(method: string, handler: (params: unknown) => void): () => void {
    return this.transport.onNotification(method, handler)
  }

  async stop(): Promise<void> {
    if (this._state === "stopped" || this._state === "stopping") return
    this._state = "stopping"
    try {
      await withTimeout(this.transport.sendRequest("shutdown"), this.shutdownTimeoutMs)
      this.transport.sendNotification("exit")
    } catch {
      // shutdown failed or timed out — escalate to process kill
      this.onKillProcess?.()
    } finally {
      this.transport.close()
      this._state = "stopped"
    }
  }

  private assertRunning(method: string): void {
    if (this._state !== "running") {
      throw new Error(`LspClient.${method} called in state ${this._state}; client must be running`)
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new LspRequestTimeoutError("shutdown", "n/a")), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}
