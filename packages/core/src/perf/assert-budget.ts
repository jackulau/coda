// R9: assertion helper shared between Playwright specs and unit tests.
//
// `assertBudget(name, samples, budgetMs, percentile?)` computes the requested
// percentile (default p95) of `samples` and either returns silently or throws
// a descriptive error. `PERF_SCALE_FACTOR` is honored: CI runners set it to
// dilate budgets that would otherwise flake on slow hardware.

import { PERF_SCALE_FACTOR_KEY, p95, p99 } from "./budget"

export type Percentile = "p50" | "p90" | "p95" | "p99" | "max" | "mean"

export interface AssertBudgetOptions {
  /**
   * Env record for PERF_SCALE_FACTOR resolution. Defaults to process.env
   * when running under Node/Bun; tests inject a pure object.
   */
  env?: Record<string, string | undefined>
}

export interface BudgetResult {
  name: string
  observed: number
  budgetMs: number
  scaledBudgetMs: number
  percentile: Percentile
  samplesUsed: number
  passed: boolean
  scaleFactor: number
}

export function scaleFactorFromEnv(env: Record<string, string | undefined>): number {
  const raw = env[PERF_SCALE_FACTOR_KEY]
  if (!raw) return 1
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

export function percentileOf(samples: readonly number[], p: Percentile): number {
  if (samples.length === 0) return 0
  if (p === "max") return Math.max(...samples)
  if (p === "mean") return samples.reduce((a, b) => a + b, 0) / samples.length
  if (p === "p95") return p95(samples as number[])
  if (p === "p99") return p99(samples as number[])
  const sorted = [...samples].sort((a, b) => a - b)
  const rank = p === "p50" ? 0.5 : 0.9
  const idx = Math.ceil(rank * sorted.length) - 1
  return sorted[Math.max(0, idx)] ?? 0
}

/**
 * Compute budget result without throwing. Used by tests + the throwing
 * wrapper below.
 */
export function checkBudget(
  name: string,
  samples: readonly number[],
  budgetMs: number,
  percentile: Percentile = "p95",
  opts: AssertBudgetOptions = {},
): BudgetResult {
  const env = opts.env ?? (typeof process !== "undefined" ? process.env : {})
  const scaleFactor = scaleFactorFromEnv(env)
  const scaledBudgetMs = budgetMs * scaleFactor
  const observed = percentileOf(samples, percentile)
  return {
    name,
    observed,
    budgetMs,
    scaledBudgetMs,
    percentile,
    samplesUsed: samples.length,
    passed: observed <= scaledBudgetMs,
    scaleFactor,
  }
}

export function assertBudget(
  name: string,
  samples: readonly number[],
  budgetMs: number,
  percentile: Percentile = "p95",
  opts: AssertBudgetOptions = {},
): BudgetResult {
  const r = checkBudget(name, samples, budgetMs, percentile, opts)
  if (!r.passed) {
    throw new BudgetExceededError(formatFailure(r))
  }
  return r
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BudgetExceededError"
  }
}

export function formatFailure(r: BudgetResult): string {
  const pct = r.percentile
  const scale = r.scaleFactor === 1 ? "" : ` (×PERF_SCALE_FACTOR=${r.scaleFactor})`
  return `budget exceeded: ${r.name} ${pct}=${r.observed.toFixed(
    2,
  )}ms > ${r.scaledBudgetMs.toFixed(2)}ms${scale} (budget ${r.budgetMs}ms, samples=${
    r.samplesUsed
  })`
}

/**
 * fps→frametime helper. A spec that measures raf deltas converts to fps via
 * 1000 / meanFrametime and compares to a target fps floor.
 */
export function fpsFromFrametimes(frametimes: readonly number[]): number {
  if (frametimes.length === 0) return 0
  const mean = frametimes.reduce((a, b) => a + b, 0) / frametimes.length
  if (mean <= 0) return 0
  return 1000 / mean
}

/**
 * Assert that observed fps meets or exceeds `floorFps`. CI may scale the
 * floor down via PERF_SCALE_FACTOR (more tolerant of slow runners).
 */
export function assertFpsFloor(
  name: string,
  frametimes: readonly number[],
  floorFps: number,
  opts: AssertBudgetOptions = {},
): { name: string; fps: number; floor: number; scaledFloor: number; passed: boolean } {
  const env = opts.env ?? (typeof process !== "undefined" ? process.env : {})
  const scaleFactor = scaleFactorFromEnv(env)
  const fps = fpsFromFrametimes(frametimes)
  // scaleFactor > 1 means "slower hardware" — loosen the floor.
  const scaledFloor = floorFps / scaleFactor
  const passed = fps >= scaledFloor
  if (!passed) {
    throw new BudgetExceededError(
      `fps floor: ${name} observed=${fps.toFixed(1)} < floor=${scaledFloor.toFixed(
        1,
      )} (PERF_SCALE_FACTOR=${scaleFactor})`,
    )
  }
  return { name, fps, floor: floorFps, scaledFloor, passed }
}
