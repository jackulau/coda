import { describe, expect, test } from "bun:test"
import { LspAdapter } from "./lsp-adapter"

describe("LspAdapter (D2)", () => {
  test("request() returns monotonically increasing ids", () => {
    const a = new LspAdapter()
    expect(a.request("textDocument/hover", 0)).toBe(1)
    expect(a.request("textDocument/definition", 1)).toBe(2)
  })

  test("resolve() returns the stored method and drops the pending entry", () => {
    const a = new LspAdapter()
    const id = a.request("textDocument/hover", 0)
    expect(a.pendingCount()).toBe(1)
    expect(a.resolve(id)?.method).toBe("textDocument/hover")
    expect(a.pendingCount()).toBe(0)
  })

  test("resolve of unknown id returns null", () => {
    const a = new LspAdapter()
    expect(a.resolve(999)).toBeNull()
  })

  test("pruneStale drops entries older than the budget", () => {
    const a = new LspAdapter()
    a.request("old", 0)
    a.request("fresh", 1000)
    const dropped = a.pruneStale(1500, 500)
    expect(dropped.length).toBe(1)
    expect(a.pendingCount()).toBe(1)
  })
})
