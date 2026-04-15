import { describe, expect, test } from "bun:test"
import { LockGraph } from "./graph"

describe("LockGraph", () => {
  test("acquire returns false when held by another", () => {
    const g = new LockGraph()
    expect(g.acquire("r1", "A", 0)).toBe(true)
    expect(g.acquire("r1", "B", 1)).toBe(false)
  })

  test("release by non-holder is rejected", () => {
    const g = new LockGraph()
    g.acquire("r1", "A", 0)
    expect(g.release("r1", "B")).toBe(false)
    expect(g.release("r1", "A")).toBe(true)
  })

  test("no deadlock when empty", () => {
    const g = new LockGraph()
    expect(g.detectDeadlock()).toBeNull()
  })

  test("simple wait without cycle is not a deadlock", () => {
    const g = new LockGraph()
    g.acquire("r1", "A", 0)
    g.enqueue("r1", "B", 1)
    expect(g.detectDeadlock()).toBeNull()
  })

  test("classic A↔B deadlock detected", () => {
    const g = new LockGraph()
    g.acquire("r1", "A", 0)
    g.acquire("r2", "B", 0)
    g.enqueue("r1", "B", 1)
    g.enqueue("r2", "A", 1)
    const report = g.detectDeadlock()
    expect(report).not.toBeNull()
    expect(new Set(report?.cycle)).toEqual(new Set(["A", "B"]))
    expect(report?.involvedResources).toEqual(["r1", "r2"])
  })

  test("3-way cycle A → B → C → A detected", () => {
    const g = new LockGraph()
    g.acquire("r1", "A", 0)
    g.acquire("r2", "B", 0)
    g.acquire("r3", "C", 0)
    g.enqueue("r1", "C", 1)
    g.enqueue("r2", "A", 1)
    g.enqueue("r3", "B", 1)
    const report = g.detectDeadlock()
    expect(report).not.toBeNull()
    expect(new Set(report?.cycle)).toEqual(new Set(["A", "B", "C"]))
  })

  test("longestWait reports max wait age", () => {
    const g = new LockGraph()
    g.acquire("r1", "A", 0)
    g.enqueue("r1", "B", 100)
    g.enqueue("r1", "C", 50)
    expect(g.longestWait(200)).toBe(150)
  })

  test("dequeue removes a waiter", () => {
    const g = new LockGraph()
    g.acquire("r1", "A", 0)
    g.enqueue("r1", "B", 1)
    g.dequeue("r1", "B")
    expect(g.detectDeadlock()).toBeNull()
  })
})
