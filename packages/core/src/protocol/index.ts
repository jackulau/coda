import { z } from "zod"
import { hmacSha256Hex, randomHex, timingSafeEqualHex } from "../util/sha256"

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
  return randomHex(32)
}

export function signRequest(token: string, body: string): string {
  return hmacSha256Hex(token, body)
}

export function verifySignature(token: string, body: string, signature: string): boolean {
  const expected = signRequest(token, body)
  return timingSafeEqualHex(expected, signature)
}
