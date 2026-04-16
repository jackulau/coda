import { describe, expect, test } from "bun:test"
import { StaticFlagEvaluator } from "../flags/flags"

const CTX_STABLE = { app: { version: "2.0.0", channel: "stable" as const }, userId: "u1" }

describe("feature flags + kill-switch (Y4)", () => {
  test("enabled flag returns true", () => {
    const e = new StaticFlagEvaluator([{ key: "test", enabled: true, rolloutPercent: 100, killSwitch: false }])
    expect(e.isOn("test", CTX_STABLE)).toBe(true)
  })

  test("disabled flag returns false", () => {
    const e = new StaticFlagEvaluator([{ key: "test", enabled: false, rolloutPercent: 100, killSwitch: false }])
    expect(e.isOn("test", CTX_STABLE)).toBe(false)
  })

  test("kill switch overrides enabled", () => {
    const e = new StaticFlagEvaluator([{ key: "test", enabled: true, rolloutPercent: 100, killSwitch: false }])
    e.killSwitch("test")
    expect(e.isOn("test", CTX_STABLE)).toBe(false)
  })

  test("unknown flag returns false (fail-closed)", () => {
    const e = new StaticFlagEvaluator()
    expect(e.isOn("nope", CTX_STABLE)).toBe(false)
  })

  test("enabledFor explicitly-listed user returns true regardless of rollout", () => {
    const e = new StaticFlagEvaluator([
      { key: "test", enabled: true, rolloutPercent: 0, killSwitch: false, enabledFor: ["u1"] },
    ])
    expect(e.isOn("test", { ...CTX_STABLE, userId: "u1" })).toBe(true)
    expect(e.isOn("test", { ...CTX_STABLE, userId: "u2" })).toBe(false)
  })

  test("rollout percent partitions users deterministically", () => {
    const e = new StaticFlagEvaluator([
      { key: "test", enabled: true, rolloutPercent: 50, killSwitch: false },
    ])
    const results = new Set<boolean>()
    for (let i = 0; i < 20; i++) {
      results.add(e.isOn("test", { ...CTX_STABLE, userId: `user-${i}` }))
    }
    // both true and false should appear at 50% rollout across 20 users
    expect(results.size).toBe(2)
  })

  test("list() returns current flags", () => {
    const e = new StaticFlagEvaluator([{ key: "a", enabled: true, rolloutPercent: 100, killSwitch: false }])
    e.upsert({ key: "b", enabled: false, rolloutPercent: 100, killSwitch: false })
    expect(e.list().map((f) => f.key).sort()).toEqual(["a", "b"])
  })
})
