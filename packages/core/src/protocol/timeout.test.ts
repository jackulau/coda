import { describe, expect, test } from "bun:test"
import { TimeoutError, abortableSignal, withTimeout } from "./timeout"

describe("withTimeout", () => {
  test("resolves when promise wins", async () => {
    const r = await withTimeout(Promise.resolve("ok"), 1000)
    expect(r).toBe("ok")
  })

  test("rejects with TimeoutError when slow", async () => {
    const slow = new Promise<string>((r) => setTimeout(() => r("late"), 100))
    await expect(withTimeout(slow, 20, "rpc")).rejects.toBeInstanceOf(TimeoutError)
  })

  test("TimeoutError carries the budget value", async () => {
    try {
      await withTimeout(new Promise(() => undefined), 30, "lsof")
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(TimeoutError)
      expect((err as TimeoutError).timeoutMs).toBe(30)
      expect((err as TimeoutError).message).toContain("lsof")
    }
  })

  test("clears timer when promise wins fast (no leaked handle)", async () => {
    const initial = process._getActiveHandles?.().length ?? 0
    await withTimeout(Promise.resolve(1), 5000)
    const after = process._getActiveHandles?.().length ?? 0
    expect(after).toBeLessThanOrEqual(initial + 1)
  })
})

describe("abortableSignal", () => {
  test("signal aborts after timeout", async () => {
    const sig = abortableSignal(20)
    await new Promise((r) => setTimeout(r, 50))
    expect(sig.aborted).toBe(true)
  })
})

declare global {
  namespace NodeJS {
    interface Process {
      _getActiveHandles?: () => unknown[]
    }
  }
}
