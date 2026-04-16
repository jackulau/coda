import { describe, expect, test } from "bun:test"
import { LockGraph } from "../locks/graph"

describe("deadlock detection + runtime invariants (J7)", () => {
  test("two-holder cycle is detected", () => {
    const g = new LockGraph()
    expect(g.acquire("A", "holderX", 1)).toBe(true)
    expect(g.acquire("B", "holderY", 2)).toBe(true)
    g.enqueue("B", "holderX", 3)
    g.enqueue("A", "holderY", 4)
    const report = g.detectDeadlock()
    expect(report).not.toBeNull()
    if (report) {
      expect(report.involvedResources.sort()).toEqual(["A", "B"])
    }
  })

  test("no deadlock when waiter does not close cycle", () => {
    const g = new LockGraph()
    expect(g.acquire("A", "x", 1)).toBe(true)
    g.enqueue("A", "y", 2)
    expect(g.detectDeadlock()).toBeNull()
  })

  test("release breaks the cycle", () => {
    const g = new LockGraph()
    g.acquire("A", "x", 1)
    g.acquire("B", "y", 2)
    g.enqueue("B", "x", 3)
    g.enqueue("A", "y", 4)
    expect(g.detectDeadlock()).not.toBeNull()
    g.release("B", "y")
    expect(g.detectDeadlock()).toBeNull()
  })

  test("longestWait returns max wait duration", () => {
    const g = new LockGraph()
    g.acquire("A", "holder", 100)
    g.enqueue("A", "w1", 200)
    expect(g.longestWait(500)).toBe(300)
  })

  test("reset clears everything", () => {
    const g = new LockGraph()
    g.acquire("A", "x", 1)
    g.enqueue("A", "y", 2)
    g.reset()
    expect(g.detectDeadlock()).toBeNull()
    expect(g.longestWait(100)).toBe(0)
  })

  test("cannot acquire already-held lock", () => {
    const g = new LockGraph()
    expect(g.acquire("A", "x", 1)).toBe(true)
    expect(g.acquire("A", "y", 2)).toBe(false)
  })
})
