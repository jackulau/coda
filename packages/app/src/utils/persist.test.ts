import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createDebouncedPersist, loadPersisted } from "./persist"

class MemStorage {
  private map = new Map<string, string>()
  setItem(k: string, v: string) {
    this.map.set(k, v)
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null
  }
  size() {
    return this.map.size
  }
}

describe("persist", () => {
  let store: MemStorage

  beforeEach(() => {
    store = new MemStorage()
  })

  afterEach(() => {
    // no-op
  })

  test("debounces writes within window", async () => {
    const p = createDebouncedPersist<{ a: number }>("k", store, 30)
    p.flush({ a: 1 })
    p.flush({ a: 2 })
    p.flush({ a: 3 })
    expect(store.size()).toBe(0)
    await new Promise((r) => setTimeout(r, 60))
    expect(store.getItem("k")).toBe(JSON.stringify({ a: 3 }))
  })

  test("cancel prevents pending write", async () => {
    const p = createDebouncedPersist<{ a: number }>("k", store, 30)
    p.flush({ a: 99 })
    p.cancel()
    await new Promise((r) => setTimeout(r, 60))
    expect(store.size()).toBe(0)
  })

  test("loadPersisted merges over fallback", () => {
    store.setItem("k", JSON.stringify({ b: 2 }))
    const out = loadPersisted("k", store, { a: 1, b: 0 })
    expect(out).toEqual({ a: 1, b: 2 })
  })

  test("loadPersisted returns fallback on missing key", () => {
    expect(loadPersisted("nope", store, { a: 1 })).toEqual({ a: 1 })
  })

  test("loadPersisted survives malformed JSON", () => {
    store.setItem("k", "{not json")
    expect(loadPersisted("k", store, { a: 1 })).toEqual({ a: 1 })
  })
})
