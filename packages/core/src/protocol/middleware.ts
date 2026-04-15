import { type RpcRequest, type RpcResponse, verifySignature } from "./index"

export const HMAC_HEADER = "X-Coda-HMAC"
export const TOKEN_HEADER = "X-Coda-Token-Id"
const DEFAULT_DEDUP_TTL_MS = 60_000

interface DedupEntry {
  response: RpcResponse
  expiresAt: number
}

export interface MiddlewareOptions {
  token: string
  now?: () => number
  dedupTtlMs?: number
  maxDedupSize?: number
}

export interface IncomingRequest {
  body: string
  headers: Record<string, string | undefined>
}

export type Handler = (req: RpcRequest) => Promise<unknown>

export class HmacMiddleware {
  private readonly token: string
  private readonly now: () => number
  private readonly dedupTtlMs: number
  private readonly maxDedupSize: number
  private readonly dedup = new Map<string, DedupEntry>()

  constructor(opts: MiddlewareOptions) {
    this.token = opts.token
    this.now = opts.now ?? (() => Date.now())
    this.dedupTtlMs = opts.dedupTtlMs ?? DEFAULT_DEDUP_TTL_MS
    this.maxDedupSize = opts.maxDedupSize ?? 10_000
  }

  async handle(incoming: IncomingRequest, handler: Handler): Promise<RpcResponse> {
    const sig = incoming.headers[HMAC_HEADER.toLowerCase()]
    if (!sig) {
      return rpcErr("missing-signature", "missing HMAC signature header")
    }
    if (!verifySignature(this.token, incoming.body, sig)) {
      return rpcErr("bad-signature", "invalid HMAC signature")
    }
    let req: RpcRequest
    try {
      const parsed = JSON.parse(incoming.body) as unknown
      req = (await import("./index")).RpcRequest.parse(parsed)
    } catch (err) {
      return rpcErr("bad-request", err instanceof Error ? err.message : String(err))
    }

    this.gc()
    const cached = this.dedup.get(req.idempotencyKey)
    if (cached && cached.expiresAt > this.now()) {
      return cached.response
    }

    let response: RpcResponse
    try {
      const result = await handler(req)
      response = { id: req.id, result }
    } catch (err) {
      response = {
        id: req.id,
        error: {
          code: "handler-error",
          message: err instanceof Error ? err.message : String(err),
        },
      }
    }

    this.dedup.set(req.idempotencyKey, {
      response,
      expiresAt: this.now() + this.dedupTtlMs,
    })

    return response
  }

  private gc(): void {
    if (this.dedup.size <= this.maxDedupSize) return
    const cutoff = this.now()
    for (const [k, v] of this.dedup) {
      if (v.expiresAt <= cutoff) this.dedup.delete(k)
    }
    if (this.dedup.size > this.maxDedupSize) {
      const overflow = this.dedup.size - this.maxDedupSize
      let i = 0
      for (const k of this.dedup.keys()) {
        if (i++ >= overflow) break
        this.dedup.delete(k)
      }
    }
  }

  dedupSize(): number {
    return this.dedup.size
  }
}

function rpcErr(code: string, message: string): RpcResponse {
  return { id: "00000000-0000-0000-0000-000000000000", error: { code, message } }
}
