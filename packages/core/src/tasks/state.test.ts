import { describe, expect, test } from "bun:test"
import { type TaskEntry, TasksState } from "./state"

const t = (overrides: Partial<TaskEntry> & { id: string }): TaskEntry => ({
  phase: "A",
  title: overrides.id,
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
  ...overrides,
})

describe("TasksState", () => {
  test("upsert + get + list", () => {
    const s = new TasksState()
    s.upsert(t({ id: "A1" }))
    expect(s.get("A1")?.id).toBe("A1")
    expect(s.list()).toHaveLength(1)
  })

  test("next() respects dependencies", () => {
    const s = new TasksState()
    s.upsert(t({ id: "A1" }))
    s.upsert(t({ id: "A2", dependencies: ["A1"] }))
    expect(s.next(0)?.id).toBe("A1")
    s.markInProgress("A1", 100)
    s.markVerified("A1", "hash", 200)
    expect(s.next(300)?.id).toBe("A2")
  })

  test("next() returns null when nothing pending", () => {
    const s = new TasksState()
    expect(s.next(0)).toBeNull()
  })

  test("markInProgress increments attempts", () => {
    const s = new TasksState()
    s.upsert(t({ id: "A1" }))
    s.markInProgress("A1", 1)
    s.markFailed("A1", "boom")
    s.markInProgress("A1", 2)
    expect(s.get("A1")?.attempts).toBe(2)
  })

  test("validate detects cycle", () => {
    const s = new TasksState()
    s.upsert(t({ id: "A1", dependencies: ["A2"] }))
    s.upsert(t({ id: "A2", dependencies: ["A1"] }))
    const errs = s.validate()
    expect(errs.some((e) => e.kind === "cycle")).toBe(true)
  })

  test("validate detects dangling dep", () => {
    const s = new TasksState()
    s.upsert(t({ id: "A1", dependencies: ["NOPE"] }))
    const errs = s.validate()
    expect(errs.some((e) => e.kind === "dangling-dep")).toBe(true)
  })

  test("validate clean state returns no errors", () => {
    const s = new TasksState()
    s.upsert(t({ id: "A1" }))
    s.upsert(t({ id: "A2", dependencies: ["A1"] }))
    expect(s.validate()).toEqual([])
  })

  test("serialize → deserialize round trip", () => {
    const s = new TasksState()
    s.upsert(t({ id: "A1", phase: "A", title: "ext types" }))
    const json = s.serialize()
    const s2 = TasksState.deserialize(json)
    expect(s2.get("A1")?.title).toBe("ext types")
  })

  test("deserialize rejects wrong version", () => {
    expect(() =>
      TasksState.deserialize(JSON.stringify({ version: 99, tasks: {} })),
    ).toThrow()
  })

  test("markVerified on missing task throws", () => {
    const s = new TasksState()
    expect(() => s.markVerified("nope", "h", 0)).toThrow(/unknown task/)
  })

  test("listByPhase filters", () => {
    const s = new TasksState()
    s.upsert(t({ id: "A1", phase: "A" }))
    s.upsert(t({ id: "B1", phase: "B" }))
    expect(s.listByPhase("A").map((x) => x.id)).toEqual(["A1"])
  })
})
