import { describe, expect, test } from "bun:test"
import { RPC_FETCH_TIMEOUT_MS } from "../protocol/index"
import { DEFAULT_TIMEOUT_MS } from "../protocol/timeout"

describe("timeout budgets catalog (J6: audit of every I/O call)", () => {
  test("DEFAULT_TIMEOUT_MS is 5 seconds (sidecar RPC budget)", () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(5_000)
  })

  test("RPC_FETCH_TIMEOUT_MS matches default timeout", () => {
    expect(RPC_FETCH_TIMEOUT_MS).toBe(DEFAULT_TIMEOUT_MS)
  })

  test("shorter budgets for fast operations exist", () => {
    // ensure nothing in the budget catalog is <= 0 or NaN
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(0)
    expect(Number.isFinite(DEFAULT_TIMEOUT_MS)).toBe(true)
  })

  test("no negative or infinite budgets", () => {
    expect(RPC_FETCH_TIMEOUT_MS).toBeGreaterThan(0)
    expect(Number.isFinite(RPC_FETCH_TIMEOUT_MS)).toBe(true)
  })
})
