import { describe, expect, test } from "bun:test"

import {
  BudgetExceededError,
  assertBudget,
  assertFpsFloor,
  checkBudget,
  fpsFromFrametimes,
  percentileOf,
  scaleFactorFromEnv,
} from "./assert-budget"

describe("scaleFactorFromEnv", () => {
  test("defaults to 1 when unset", () => {
    expect(scaleFactorFromEnv({})).toBe(1)
  })
  test("parses positive floats", () => {
    expect(scaleFactorFromEnv({ PERF_SCALE_FACTOR: "2.5" })).toBe(2.5)
  })
  test("rejects non-positive or non-numeric values", () => {
    expect(scaleFactorFromEnv({ PERF_SCALE_FACTOR: "0" })).toBe(1)
    expect(scaleFactorFromEnv({ PERF_SCALE_FACTOR: "-1" })).toBe(1)
    expect(scaleFactorFromEnv({ PERF_SCALE_FACTOR: "garbage" })).toBe(1)
  })
})

describe("percentileOf", () => {
  test("empty returns 0", () => {
    expect(percentileOf([], "p95")).toBe(0)
  })
  test("max returns largest", () => {
    expect(percentileOf([1, 2, 10, 3], "max")).toBe(10)
  })
  test("mean returns average", () => {
    expect(percentileOf([1, 2, 3], "mean")).toBe(2)
  })
  test("p95 on 20 samples", () => {
    const samples = Array.from({ length: 20 }, (_, i) => i + 1) // 1..20
    // ceil(0.95 * 20) - 1 = 18 → sorted[18] = 19
    expect(percentileOf(samples, "p95")).toBe(19)
  })
  test("p99 on 100 samples", () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1)
    // ceil(0.99 * 100) - 1 = 98 → 99
    expect(percentileOf(samples, "p99")).toBe(99)
  })
  test("p50 is median", () => {
    expect(percentileOf([1, 2, 3, 4, 5], "p50")).toBe(3)
  })
})

describe("checkBudget", () => {
  test("passes when percentile under budget", () => {
    const r = checkBudget("x", [10, 20, 30], 50)
    expect(r.passed).toBe(true)
    expect(r.scaledBudgetMs).toBe(50)
  })
  test("scales budget with PERF_SCALE_FACTOR", () => {
    const r = checkBudget("x", [60], 50, "p95", {
      env: { PERF_SCALE_FACTOR: "2" },
    })
    expect(r.passed).toBe(true)
    expect(r.scaledBudgetMs).toBe(100)
  })
  test("fails when over scaled budget", () => {
    const r = checkBudget("x", [120], 50, "p95", {
      env: { PERF_SCALE_FACTOR: "2" },
    })
    expect(r.passed).toBe(false)
  })
})

describe("assertBudget", () => {
  test("returns result on pass", () => {
    const r = assertBudget("x", [1, 2, 3], 10)
    expect(r.passed).toBe(true)
  })
  test("throws BudgetExceededError on fail with descriptive message", () => {
    try {
      assertBudget("worktree-switch", [10, 20, 100], 50)
      throw new Error("expected throw")
    } catch (err) {
      expect(err).toBeInstanceOf(BudgetExceededError)
      expect((err as Error).message).toMatch(/worktree-switch/)
      expect((err as Error).message).toMatch(/budget/)
    }
  })
  test("honors percentile argument", () => {
    const samples = [10, 20, 30, 40, 50, 60, 70, 80, 90, 200]
    // p95 of 10 samples: ceil(0.95*10) - 1 = 9 → samples[9] = 200
    const r = checkBudget("x", samples, 100, "p95")
    expect(r.passed).toBe(false)
    // but the p50 is 50, under budget
    const r2 = checkBudget("x", samples, 100, "p50")
    expect(r2.passed).toBe(true)
  })
})

describe("fpsFromFrametimes", () => {
  test("60fps for 16.67ms frames", () => {
    const ft = Array(10).fill(1000 / 60)
    expect(fpsFromFrametimes(ft)).toBeCloseTo(60, 1)
  })
  test("120fps for 8.33ms frames", () => {
    const ft = Array(10).fill(1000 / 120)
    expect(fpsFromFrametimes(ft)).toBeCloseTo(120, 1)
  })
  test("0 on empty input", () => {
    expect(fpsFromFrametimes([])).toBe(0)
  })
})

describe("assertFpsFloor", () => {
  test("passes when fps >= floor", () => {
    const ft = Array(10).fill(1000 / 90) // ~90fps
    const r = assertFpsFloor("scroll", ft, 60)
    expect(r.passed).toBe(true)
    expect(r.fps).toBeCloseTo(90, 1)
  })
  test("loosens floor when PERF_SCALE_FACTOR > 1", () => {
    const ft = Array(10).fill(1000 / 45) // ~45fps
    const r = assertFpsFloor("scroll", ft, 60, { env: { PERF_SCALE_FACTOR: "2" } })
    // floor/2 = 30, fps=45 → pass
    expect(r.passed).toBe(true)
    expect(r.scaledFloor).toBe(30)
  })
  test("throws when fps below scaled floor", () => {
    const ft = Array(10).fill(1000 / 20) // ~20fps
    expect(() => assertFpsFloor("scroll", ft, 60)).toThrow(BudgetExceededError)
  })
})
