import { describe, expect, test } from "bun:test"
import { Tasks } from "../packages/core/src"
import { gatePhase } from "./phase-gate"

const t = (p: Partial<Tasks.TaskEntry>): Tasks.TaskEntry => ({
  id: "X",
  phase: "X",
  title: "",
  status: "pending",
  dependencies: [],
  startedAt: null,
  completedAt: null,
  attempts: 0,
  lastError: null,
  verificationCommand: "true",
  verificationLastPassedAt: null,
  idempotentHash: null,
  files: [],
  ...p,
})

function stateWith(entries: Tasks.TaskEntry[]): Tasks.TasksState {
  const s = new Tasks.TasksState()
  for (const e of entries) s.upsert(e)
  return s
}

describe("gatePhase", () => {
  test("empty phase → code 3 (unknown)", () => {
    const r = gatePhase(stateWith([]), "A")
    expect(r.code).toBe(3)
  })

  test("all verified → code 0", () => {
    const s = stateWith([
      t({ id: "A1", phase: "A", status: "verified" }),
      t({ id: "A2", phase: "A", status: "verified" }),
    ])
    expect(gatePhase(s, "A").code).toBe(0)
  })

  test("one pending → code 1 with that task in pending list", () => {
    const s = stateWith([
      t({ id: "A1", phase: "A", status: "verified" }),
      t({ id: "A2", phase: "A", status: "pending" }),
    ])
    const r = gatePhase(s, "A")
    expect(r.code).toBe(1)
    expect(r.pending.map((p) => p.id)).toEqual(["A2"])
  })

  test("one in_progress → code 1", () => {
    const s = stateWith([t({ id: "A1", phase: "A", status: "in_progress" })])
    expect(gatePhase(s, "A").code).toBe(1)
  })

  test("one failed → code 1", () => {
    const s = stateWith([t({ id: "A1", phase: "A", status: "failed" })])
    const r = gatePhase(s, "A")
    expect(r.code).toBe(1)
    expect(r.pending[0]?.status).toBe("failed")
  })

  test("one blocked → code 1 (still not done)", () => {
    const s = stateWith([t({ id: "A1", phase: "A", status: "blocked" })])
    expect(gatePhase(s, "A").code).toBe(1)
  })

  test("gate is scoped to the requested phase", () => {
    const s = stateWith([
      t({ id: "A1", phase: "A", status: "verified" }),
      t({ id: "B1", phase: "B", status: "pending" }),
    ])
    expect(gatePhase(s, "A").code).toBe(0)
    expect(gatePhase(s, "B").code).toBe(1)
  })

  test("totalTasks counts the phase size", () => {
    const s = stateWith([
      t({ id: "A1", phase: "A", status: "verified" }),
      t({ id: "A2", phase: "A", status: "verified" }),
      t({ id: "A3", phase: "A", status: "pending" }),
    ])
    expect(gatePhase(s, "A").totalTasks).toBe(3)
  })
})
