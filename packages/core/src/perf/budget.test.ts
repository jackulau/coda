import { describe, expect, test } from "bun:test"
import { DEFAULT_BUDGETS, checkWorktreeSwitch, p95, p99, scaledBudget } from "./budget"

describe("p95 / p99", () => {
  test("p95 of 100 samples 1..100 is 95", () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(p95(samples)).toBe(95)
  })

  test("p99 of 100 samples 1..100 is 99", () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(p99(samples)).toBe(99)
  })

  test("empty samples → 0", () => {
    expect(p95([])).toBe(0)
    expect(p99([])).toBe(0)
  })

  test("single sample is its own p95", () => {
    expect(p95([42])).toBe(42)
  })
})

describe("scaledBudget", () => {
  test("no factor → defaults", () => {
    expect(scaledBudget({})).toEqual(DEFAULT_BUDGETS)
  })

  test("factor=4 multiplies time budgets, divides fps", () => {
    const out = scaledBudget({ PERF_SCALE_FACTOR: "4" })
    expect(out.coldStartMs).toBe(6000)
    expect(out.worktreeSwitchP95Ms).toBe(200)
    expect(out.scrollFps.target).toBe(30)
    expect(out.scrollFps.floor).toBe(15)
  })

  test("invalid factor falls back to 1", () => {
    expect(scaledBudget({ PERF_SCALE_FACTOR: "abc" })).toEqual(DEFAULT_BUDGETS)
    expect(scaledBudget({ PERF_SCALE_FACTOR: "-2" })).toEqual(DEFAULT_BUDGETS)
    expect(scaledBudget({ PERF_SCALE_FACTOR: "0" })).toEqual(DEFAULT_BUDGETS)
  })
})

describe("checkWorktreeSwitch", () => {
  test("passes when p95 under budget", () => {
    const samples = Array.from({ length: 100 }, () => 30)
    expect(checkWorktreeSwitch(samples, DEFAULT_BUDGETS)).toEqual({ passed: true })
  })

  test("fails with reason when p95 over budget", () => {
    const samples = Array.from({ length: 99 }, () => 10)
    samples.push(200)
    samples.push(200)
    samples.push(200)
    samples.push(200)
    samples.push(200)
    samples.push(200)
    const out = checkWorktreeSwitch(samples, DEFAULT_BUDGETS)
    expect(out.passed).toBe(false)
    expect(out.reason).toContain("p95")
    expect(out.reason).toContain("budget")
  })
})
