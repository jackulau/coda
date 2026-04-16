import { describe, expect, test } from "bun:test"
import { type AgentRun, needsAttention, sortDashboard, summarize } from "./state"

const run = (overrides: Partial<AgentRun> = {}): AgentRun => ({
  id: "r1",
  workspaceId: "w1",
  agentKind: "claude-code",
  status: "idle",
  startedAt: 0,
  lastActivityAt: 0,
  tokenCount: 0,
  cost: 0,
  label: "Run",
  ...overrides,
})

describe("summarize", () => {
  test("counts by status + totals", () => {
    const s = summarize([
      run({ status: "running", tokenCount: 100, cost: 0.01, workspaceId: "a" }),
      run({ status: "awaiting-input", tokenCount: 50, cost: 0.005, workspaceId: "b" }),
      run({ status: "running", tokenCount: 200, cost: 0.02, workspaceId: "a" }),
    ])
    expect(s.byStatus.running).toBe(2)
    expect(s.byStatus["awaiting-input"]).toBe(1)
    expect(s.totalTokens).toBe(350)
    expect(s.totalCost).toBeCloseTo(0.035, 5)
    expect(s.activeWorkspaces).toEqual(["a", "b"])
  })

  test("empty list → zeros", () => {
    const s = summarize([])
    expect(s.total).toBe(0)
    expect(s.totalTokens).toBe(0)
  })
})

describe("sortDashboard", () => {
  test("error first, then awaiting, running, idle, finished", () => {
    const runs = [
      run({ id: "i", status: "idle" }),
      run({ id: "e", status: "error" }),
      run({ id: "r", status: "running" }),
      run({ id: "a", status: "awaiting-input" }),
      run({ id: "f", status: "finished" }),
    ]
    expect(sortDashboard(runs).map((r) => r.id)).toEqual(["e", "a", "r", "i", "f"])
  })

  test("same status sorted by lastActivityAt desc", () => {
    const runs = [
      run({ id: "a", status: "running", lastActivityAt: 1 }),
      run({ id: "b", status: "running", lastActivityAt: 5 }),
    ]
    expect(sortDashboard(runs).map((r) => r.id)).toEqual(["b", "a"])
  })
})

describe("needsAttention", () => {
  test("filters awaiting + error", () => {
    expect(
      needsAttention([
        run({ id: "a", status: "running" }),
        run({ id: "b", status: "awaiting-input" }),
        run({ id: "c", status: "error" }),
      ]).map((r) => r.id),
    ).toEqual(["b", "c"])
  })
})
