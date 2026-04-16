import { describe, expect, test } from "bun:test"
import { TimeoutError, abortableSignal, withTimeout } from "../protocol/timeout"

describe("withTimeout (J6: timeout budgets)", () => {
  test("resolves when work completes before budget", async () => {
    const quick = new Promise<number>((r) => setTimeout(() => r(42), 5))
    await expect(withTimeout(quick, 100, "quick")).resolves.toBe(42)
  })

  test("rejects with TimeoutError when work exceeds budget", async () => {
    const slow = new Promise<number>((r) => setTimeout(() => r(1), 50))
    await expect(withTimeout(slow, 10, "slow")).rejects.toBeInstanceOf(TimeoutError)
  })

  test("TimeoutError carries label and budget", async () => {
    const slow = new Promise<void>((r) => setTimeout(r, 50))
    try {
      await withTimeout(slow, 10, "my-op")
      throw new Error("should have thrown")
    } catch (err) {
      if (err instanceof TimeoutError) {
        expect(err.timeoutMs).toBe(10)
        expect(err.message).toContain("my-op")
      } else {
        throw err
      }
    }
  })

  test("abortableSignal fires after timeout", async () => {
    const sig = abortableSignal(10)
    await new Promise((r) => setTimeout(r, 40))
    expect(sig.aborted).toBe(true)
  })

  test("abortableSignal does not fire before timeout", async () => {
    const sig = abortableSignal(100)
    await new Promise((r) => setTimeout(r, 5))
    expect(sig.aborted).toBe(false)
  })

  test("rejection from the wrapped promise propagates without timing out", async () => {
    const err = new Error("real-failure")
    const failing = new Promise<void>((_, reject) => setTimeout(() => reject(err), 5))
    await expect(withTimeout(failing, 100, "fail")).rejects.toBe(err)
  })
})
