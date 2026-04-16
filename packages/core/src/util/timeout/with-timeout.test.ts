import { describe, expect, test } from "bun:test"
import { TIMEOUTS, getTimeout, listTimeouts } from "./timeouts"
import { TimeoutError, withTimeout } from "./with-timeout"

describe("withTimeout", () => {
  test("resolves before timeout", async () => {
    const v = await withTimeout("x", 100, () => Promise.resolve(42))
    expect(v).toBe(42)
  })

  test("rejects with TimeoutError at deadline", async () => {
    const p = withTimeout("x", 5, () => new Promise<never>(() => {}))
    let caught: unknown
    try {
      await p
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(TimeoutError)
    if (caught instanceof TimeoutError) {
      expect(caught.tag).toBe("x")
      expect(caught.ms).toBe(5)
    }
  })

  test("signal aborted when timeout fires", async () => {
    let aborted = false
    try {
      await withTimeout("abort-x", 5, (sig) => {
        return new Promise<never>((_, reject) => {
          sig.addEventListener("abort", () => {
            aborted = true
            reject(sig.reason)
          })
        })
      })
    } catch {}
    expect(aborted).toBe(true)
  })

  test("external AbortSignal propagates", async () => {
    const outer = new AbortController()
    let seenAbort = false
    const p = withTimeout(
      "external",
      1000,
      (sig) =>
        new Promise<never>((_, reject) => {
          sig.addEventListener("abort", () => {
            seenAbort = true
            reject(new Error("aborted"))
          })
        }),
      { signal: outer.signal },
    )
    outer.abort()
    await p.catch(() => {})
    expect(seenAbort).toBe(true)
  })

  test("negative ms throws synchronously", () => {
    expect(() => withTimeout("bad", -1, () => Promise.resolve(1))).toThrow(RangeError)
  })

  test("non-finite ms throws synchronously", () => {
    expect(() =>
      withTimeout("bad", Number.NaN as unknown as number, () => Promise.resolve(1)),
    ).toThrow(TypeError)
  })
})

describe("TIMEOUTS registry", () => {
  test("every entry has a positive ms and behavior", () => {
    for (const t of listTimeouts()) {
      expect(t.ms).toBeGreaterThan(0)
      expect(t.behavior.length).toBeGreaterThan(0)
      expect(t.name.length).toBeGreaterThan(0)
    }
  })

  test("getTimeout returns same object reference as registry", () => {
    expect(getTimeout("sidecar.rpc")).toBe(TIMEOUTS["sidecar.rpc"])
  })

  test("sidecar.rpc is 5 s, github.api is 10 s (spec-fixed)", () => {
    expect(TIMEOUTS["sidecar.rpc"].ms).toBe(5000)
    expect(TIMEOUTS["github.api"].ms).toBe(10_000)
    expect(TIMEOUTS["agent.resume"].ms).toBe(10_000)
  })
})
