import { describe, expect, test } from "bun:test"
import { generateSessionToken, signRequest } from "./index"
import { HMAC_HEADER, HmacMiddleware } from "./middleware"

function buildReq(method: string, params: unknown = {}): { body: string; req: object } {
  const req = {
    id: crypto.randomUUID(),
    method,
    params,
    idempotencyKey: crypto.randomUUID(),
    ts: Date.now(),
  }
  return { body: JSON.stringify(req), req }
}

describe("HmacMiddleware", () => {
  test("rejects request without signature header", async () => {
    const mw = new HmacMiddleware({ token: generateSessionToken() })
    const { body } = buildReq("ping")
    const res = await mw.handle({ body, headers: {} }, async () => "pong")
    expect(res.error?.code).toBe("missing-signature")
  })

  test("rejects request with wrong signature", async () => {
    const mw = new HmacMiddleware({ token: generateSessionToken() })
    const { body } = buildReq("ping")
    const res = await mw.handle(
      { body, headers: { [HMAC_HEADER.toLowerCase()]: "deadbeef" } },
      async () => "pong",
    )
    expect(res.error?.code).toBe("bad-signature")
  })

  test("accepts request with correct signature", async () => {
    const token = generateSessionToken()
    const mw = new HmacMiddleware({ token })
    const { body } = buildReq("ping")
    const sig = signRequest(token, body)
    const res = await mw.handle(
      { body, headers: { [HMAC_HEADER.toLowerCase()]: sig } },
      async () => "pong",
    )
    expect(res.result).toBe("pong")
    expect(res.error).toBeUndefined()
  })

  test("idempotency dedup returns cached response within TTL", async () => {
    const token = generateSessionToken()
    const mw = new HmacMiddleware({ token, dedupTtlMs: 1000, now: () => 0 })
    const { body } = buildReq("createWorkspace")
    const sig = signRequest(token, body)
    let calls = 0
    const handler = async () => {
      calls++
      return { id: calls }
    }
    const a = await mw.handle({ body, headers: { [HMAC_HEADER.toLowerCase()]: sig } }, handler)
    const b = await mw.handle({ body, headers: { [HMAC_HEADER.toLowerCase()]: sig } }, handler)
    expect(a.result).toEqual({ id: 1 })
    expect(b.result).toEqual({ id: 1 })
    expect(calls).toBe(1)
  })

  test("idempotency entry expires after TTL", async () => {
    const token = generateSessionToken()
    let now = 0
    const mw = new HmacMiddleware({ token, dedupTtlMs: 1000, now: () => now })
    const { body } = buildReq("createWorkspace")
    const sig = signRequest(token, body)
    let calls = 0
    const handler = async () => ++calls
    await mw.handle({ body, headers: { [HMAC_HEADER.toLowerCase()]: sig } }, handler)
    now = 5000
    await mw.handle({ body, headers: { [HMAC_HEADER.toLowerCase()]: sig } }, handler)
    expect(calls).toBe(2)
  })

  test("handler throwing returns typed error response", async () => {
    const token = generateSessionToken()
    const mw = new HmacMiddleware({ token })
    const { body } = buildReq("boom")
    const sig = signRequest(token, body)
    const res = await mw.handle({ body, headers: { [HMAC_HEADER.toLowerCase()]: sig } }, () => {
      throw new Error("kaboom")
    })
    expect(res.error?.code).toBe("handler-error")
    expect(res.error?.message).toBe("kaboom")
  })

  test("malformed JSON body returns bad-request", async () => {
    const token = generateSessionToken()
    const mw = new HmacMiddleware({ token })
    const body = "{not-json"
    const sig = signRequest(token, body)
    const res = await mw.handle(
      { body, headers: { [HMAC_HEADER.toLowerCase()]: sig } },
      async () => "ok",
    )
    expect(res.error?.code).toBe("bad-request")
  })
})
