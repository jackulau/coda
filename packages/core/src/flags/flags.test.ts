import { describe, expect, test } from "bun:test"
import { type FlagContext, StaticFlagEvaluator } from "./flags"

const ctx = (overrides: Partial<FlagContext> = {}): FlagContext => ({
  app: { version: "2.0.0", channel: "stable" },
  ...overrides,
})

describe("StaticFlagEvaluator", () => {
  test("undefined flag → false", () => {
    expect(new StaticFlagEvaluator().isOn("missing", ctx())).toBe(false)
  })

  test("disabled flag → false", () => {
    const e = new StaticFlagEvaluator([
      { key: "x", enabled: false, rolloutPercent: 100, killSwitch: false },
    ])
    expect(e.isOn("x", ctx())).toBe(false)
  })

  test("enabled+100% → true regardless of subject", () => {
    const e = new StaticFlagEvaluator([
      { key: "x", enabled: true, rolloutPercent: 100, killSwitch: false },
    ])
    expect(e.isOn("x", ctx({ userId: "alice" }))).toBe(true)
    expect(e.isOn("x", ctx({ userId: "bob" }))).toBe(true)
  })

  test("kill switch overrides everything", () => {
    const e = new StaticFlagEvaluator([
      { key: "x", enabled: true, rolloutPercent: 100, killSwitch: true },
    ])
    expect(e.isOn("x", ctx({ userId: "alice" }))).toBe(false)
  })

  test("enabledFor allowlist hits even at 0%", () => {
    const e = new StaticFlagEvaluator([
      {
        key: "beta",
        enabled: true,
        rolloutPercent: 0,
        killSwitch: false,
        enabledFor: ["alice"],
      },
    ])
    expect(e.isOn("beta", ctx({ userId: "alice" }))).toBe(true)
    expect(e.isOn("beta", ctx({ userId: "bob" }))).toBe(false)
  })

  test("rollout is deterministic per (key,subject)", () => {
    const e = new StaticFlagEvaluator([
      { key: "x", enabled: true, rolloutPercent: 50, killSwitch: false },
    ])
    const a = e.isOn("x", ctx({ userId: "alice" }))
    const b = e.isOn("x", ctx({ userId: "alice" }))
    expect(a).toBe(b)
  })

  test("rollout 50% lands on roughly half across many subjects", () => {
    const e = new StaticFlagEvaluator([
      { key: "x", enabled: true, rolloutPercent: 50, killSwitch: false },
    ])
    let on = 0
    const N = 1000
    for (let i = 0; i < N; i++) {
      if (e.isOn("x", ctx({ userId: `user-${i}` }))) on++
    }
    expect(on).toBeGreaterThan(N * 0.4)
    expect(on).toBeLessThan(N * 0.6)
  })

  test("killSwitch() flips an existing flag without re-defining", () => {
    const e = new StaticFlagEvaluator([
      { key: "x", enabled: true, rolloutPercent: 100, killSwitch: false },
    ])
    expect(e.isOn("x", ctx())).toBe(true)
    e.killSwitch("x")
    expect(e.isOn("x", ctx())).toBe(false)
  })
})
