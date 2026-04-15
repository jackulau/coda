import { describe, expect, test } from "bun:test"
import { redact, redactObject } from "./redact"

describe("redact", () => {
  test("redacts Anthropic API keys", () => {
    const out = redact("ANTHROPIC_API_KEY=sk-ant-api03-aaaaaaaaaaaaaaaa-bbbb")
    expect(out).not.toContain("api03-aaaaaaaaaaaaaaaa-bbbb")
    expect(out).toContain("<redacted>")
  })

  test("redacts GitHub PAT tokens", () => {
    const out = redact("token: ghp_1234567890abcdefghij")
    expect(out).toContain("ghp_<redacted>")
    expect(out).not.toContain("ghp_1234567890abcdefghij")
  })

  test("redacts Authorization Bearer headers", () => {
    expect(redact("Authorization: Bearer abcdef.xyz123")).toBe("Authorization: Bearer <redacted>")
  })

  test("redacts UUIDs (often session IDs)", () => {
    const out = redact("sessionId=550e8400-e29b-41d4-a716-446655440000")
    expect(out).toBe("sessionId=<uuid>")
  })

  test("does not redact innocuous strings", () => {
    expect(redact("user logged in successfully")).toBe("user logged in successfully")
  })

  test("redacts AWS access keys", () => {
    expect(redact("AKIAIOSFODNN7EXAMPLE used")).toContain("AKIA<redacted>")
  })

  test("redacts api_key=value patterns", () => {
    expect(redact('api_key="my-secret-value"')).toContain("<redacted>")
  })
})

describe("redactObject", () => {
  test("redacts string values matching secret keys", () => {
    const out = redactObject({ apiKey: "supersecret", count: 4 })
    expect(out).toEqual({ apiKey: "<redacted>", count: 4 })
  })

  test("recurses into nested objects + arrays", () => {
    const out = redactObject({
      users: [{ name: "alice", token: "abc123" }],
      meta: { password: "p", normal: "ok" },
    })
    expect(out).toEqual({
      users: [{ name: "alice", token: "<redacted>" }],
      meta: { password: "<redacted>", normal: "ok" },
    })
  })

  test("preserves non-string primitives", () => {
    expect(redactObject(42)).toBe(42)
    expect(redactObject(null)).toBe(null)
    expect(redactObject(undefined)).toBe(undefined)
    expect(redactObject(true)).toBe(true)
  })

  test("redacts secret patterns inside string values not matched by key", () => {
    const out = redactObject({ logLine: "Authorization: Bearer xyz123abc" })
    expect((out as { logLine: string }).logLine).toBe("Authorization: Bearer <redacted>")
  })
})
