import { describe, expect, test } from "bun:test"
import { generateSessionToken, signRequest, verifySignature } from "./index"

describe("HMAC sidecar protocol", () => {
  test("generates 64-char hex tokens", () => {
    const t = generateSessionToken()
    expect(t).toMatch(/^[0-9a-f]{64}$/)
  })

  test("signs and verifies a request", () => {
    const token = generateSessionToken()
    const body = JSON.stringify({ method: "ping" })
    const sig = signRequest(token, body)
    expect(verifySignature(token, body, sig)).toBe(true)
  })

  test("rejects modified body (sidecar_rpc_rejected_without_valid_hmac_token)", () => {
    const token = generateSessionToken()
    const sig = signRequest(token, "original")
    expect(verifySignature(token, "tampered", sig)).toBe(false)
  })

  test("rejects mismatched signature length without throwing", () => {
    const token = generateSessionToken()
    expect(verifySignature(token, "x", "abc")).toBe(false)
  })

  test("rejects forged signature with another token", () => {
    const a = generateSessionToken()
    const b = generateSessionToken()
    const body = "payload"
    const sigA = signRequest(a, body)
    expect(verifySignature(b, body, sigA)).toBe(false)
  })
})
