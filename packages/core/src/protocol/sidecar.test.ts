import { describe, expect, test } from "bun:test"
import {
  generateSessionToken,
  RPC_FETCH_TIMEOUT_MS,
  type RpcRequest,
  signRequest,
  verifySignature,
} from "./index"
import { HMAC_HEADER, HmacMiddleware } from "./middleware"
import { TimeoutError, withTimeout } from "./timeout"

function makeRequest(method = "ping"): RpcRequest {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    method,
    params: { ok: true },
    idempotencyKey: "22222222-2222-2222-2222-222222222222",
    ts: 0,
  }
}

function encode(req: RpcRequest): string {
  return JSON.stringify(req)
}

describe("sidecar HMAC authentication", () => {
  test("RPC call without HMAC token returns 401-equivalent error", async () => {
    const token = generateSessionToken()
    const mw = new HmacMiddleware({ token })
    const req = makeRequest()
    const res = await mw.handle({ body: encode(req), headers: {} }, async () => ({ pong: true }))
    expect(res.error?.code).toBe("missing-signature")
  })

  test("RPC call with wrong HMAC returns bad-signature", async () => {
    const token = generateSessionToken()
    const mw = new HmacMiddleware({ token })
    const req = makeRequest()
    const body = encode(req)
    const badSig = signRequest("not-the-token", body)
    const res = await mw.handle(
      { body, headers: { [HMAC_HEADER.toLowerCase()]: badSig } },
      async () => ({ pong: true }),
    )
    expect(res.error?.code).toBe("bad-signature")
  })

  test("RPC call with correct HMAC succeeds", async () => {
    const token = generateSessionToken()
    const mw = new HmacMiddleware({ token })
    const req = makeRequest()
    const body = encode(req)
    const sig = signRequest(token, body)
    const res = await mw.handle(
      { body, headers: { [HMAC_HEADER.toLowerCase()]: sig } },
      async () => ({ pong: true }),
    )
    expect(res.error).toBeUndefined()
    expect((res.result as { pong: true }).pong).toBe(true)
  })
})

describe("verifySignature uses timing-safe comparison", () => {
  test("roundtrip sign → verify is true", () => {
    const token = generateSessionToken()
    const body = encode(makeRequest())
    const sig = signRequest(token, body)
    expect(verifySignature(token, body, sig)).toBe(true)
  })

  test("wrong signature returns false", () => {
    const token = generateSessionToken()
    const body = encode(makeRequest())
    expect(verifySignature(token, body, "deadbeef")).toBe(false)
  })
})

describe("AbortSignal.timeout(5000) fires when sidecar sleeps", () => {
  test("withTimeout rejects with TimeoutError when sidecar sleeps past budget", async () => {
    const slow = new Promise<void>((resolve) => setTimeout(resolve, 50))
    await expect(withTimeout(slow, 10, "rpc")).rejects.toBeInstanceOf(TimeoutError)
  })

  test("RPC_FETCH_TIMEOUT_MS is 5000 per spec", () => {
    expect(RPC_FETCH_TIMEOUT_MS).toBe(5000)
  })
})

describe("HMAC secret rotation on respawn", () => {
  test("middleware built with new token rejects signatures from old token", async () => {
    const oldToken = generateSessionToken()
    const newToken = generateSessionToken()
    const mw = new HmacMiddleware({ token: newToken })
    const req = makeRequest()
    const body = encode(req)
    const oldSig = signRequest(oldToken, body)
    const res = await mw.handle(
      { body, headers: { [HMAC_HEADER.toLowerCase()]: oldSig } },
      async () => ({ pong: true }),
    )
    expect(res.error?.code).toBe("bad-signature")
  })
})
