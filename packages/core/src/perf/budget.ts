export const PERF_SCALE_FACTOR_KEY = "PERF_SCALE_FACTOR"

export interface PerfBudgets {
  coldStartMs: number
  worktreeSwitchP95Ms: number
  scrollFps: { target: number; floor: number }
  layoutRestoreMs: number
}

export const DEFAULT_BUDGETS: PerfBudgets = {
  coldStartMs: 1500,
  worktreeSwitchP95Ms: 50,
  scrollFps: { target: 120, floor: 60 },
  layoutRestoreMs: 800,
}

export function scaledBudget(env: Record<string, string | undefined>): PerfBudgets {
  const factor = parseFactor(env[PERF_SCALE_FACTOR_KEY])
  return {
    coldStartMs: Math.round(DEFAULT_BUDGETS.coldStartMs * factor),
    worktreeSwitchP95Ms: Math.round(DEFAULT_BUDGETS.worktreeSwitchP95Ms * factor),
    scrollFps: {
      target: Math.round(DEFAULT_BUDGETS.scrollFps.target / factor),
      floor: Math.round(DEFAULT_BUDGETS.scrollFps.floor / factor),
    },
    layoutRestoreMs: Math.round(DEFAULT_BUDGETS.layoutRestoreMs * factor),
  }
}

function parseFactor(raw: string | undefined): number {
  if (!raw) return 1
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0) return 1
  return n
}

export function p95(samples: number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const idx = Math.ceil(0.95 * sorted.length) - 1
  return sorted[Math.max(0, idx)] ?? 0
}

export function p99(samples: number[]): number {
  if (samples.length === 0) return 0
  const sorted = [...samples].sort((a, b) => a - b)
  const idx = Math.ceil(0.99 * sorted.length) - 1
  return sorted[Math.max(0, idx)] ?? 0
}

export interface BudgetCheck {
  passed: boolean
  reason?: string
}

export function checkWorktreeSwitch(samples: number[], budgets: PerfBudgets): BudgetCheck {
  const observed = p95(samples)
  if (observed > budgets.worktreeSwitchP95Ms) {
    return {
      passed: false,
      reason: `worktree-switch p95 ${observed}ms > budget ${budgets.worktreeSwitchP95Ms}ms`,
    }
  }
  return { passed: true }
}
