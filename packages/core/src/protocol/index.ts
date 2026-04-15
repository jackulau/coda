import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import { z } from "zod"

export const RpcRequest = z.object({
  id: z.string().uuid(),
  method: z.string().min(1),
  params: z.unknown().optional(),
  idempotencyKey: z.string().uuid(),
  ts: z.number().int().nonnegative(),
})

export type RpcRequest = z.infer<typeof RpcRequest>

export const RpcResponse = z.object({
  id: z.string().uuid(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
})

export type RpcResponse = z.infer<typeof RpcResponse>

export const RPC_FETCH_TIMEOUT_MS = 5000
export const IDEMPOTENCY_TTL_MS = 60_000

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex")
}

export function signRequest(token: string, body: string): string {
  return createHmac("sha256", token).update(body).digest("hex")
}

export function verifySignature(token: string, body: string, signature: string): boolean {
  const expected = signRequest(token, body)
  if (expected.length !== signature.length) return false
  try {
    const a = new Uint8Array(Buffer.from(expected, "hex"))
    const b = new Uint8Array(Buffer.from(signature, "hex"))
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
