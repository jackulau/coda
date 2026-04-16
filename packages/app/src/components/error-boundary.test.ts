import { describe, expect, test } from "bun:test"
import { normalizeError } from "./error-normalize"

describe("ErrorBoundary helpers (J1)", () => {
  test("normalizeError passes Error instances through", () => {
    const e = new Error("boom")
    expect(normalizeError(e)).toBe(e)
  })

  test("normalizeError wraps strings", () => {
    expect(normalizeError("boom").message).toBe("boom")
  })

  test("normalizeError serializes objects", () => {
    const e = normalizeError({ code: 42 })
    expect(e.message).toContain("42")
  })
})
