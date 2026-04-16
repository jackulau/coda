import { describe, expect, test } from "bun:test"
import type { TaskEntry } from "../tasks/state"
import { planResume } from "./state"

const task = (overrides: Partial<TaskEntry> = {}): TaskEntry => ({
  id: "A1",
  phase: "A",
  title: "x",
  status: "in_progress",
  dependencies: [],
  startedAt: 1,
  startedAtSha: null,
  completedAt: null,
  attempts: 1,
  lastError: null,
  verificationCommand: "true",
  verificationLastPassedAt: null,
  idempotentHash: null,
  files: ["a.ts", "b.ts"],
  ...overrides,
})

describe("planResume", () => {
  test("non-in-progress task → none", () => {
    const out = planResume(
      task({ status: "pending" }),
      { workingTreeDirty: false, currentSha: "x", inReflog: true },
      { mode: "continue" },
    )
    expect(out.kind).toBe("none")
  })

  test("clean tree + in_progress → mark-pending", () => {
    const out = planResume(
      task(),
      { workingTreeDirty: false, currentSha: "x", inReflog: true },
      { mode: "continue" },
    )
    expect(out.kind).toBe("mark-pending")
  })

  test("dirty + continue → continue", () => {
    const out = planResume(
      task(),
      { workingTreeDirty: true, currentSha: "x", inReflog: true },
      { mode: "continue" },
    )
    expect(out.kind).toBe("continue")
  })

  test("dirty + abandon → abandon with files", () => {
    const out = planResume(
      task({ files: ["one.ts", "two.ts"] }),
      { workingTreeDirty: true, currentSha: "x", inReflog: true },
      { mode: "abandon" },
    )
    expect(out.kind).toBe("abandon")
    if (out.kind === "abandon") expect(out.files).toEqual(["one.ts", "two.ts"])
  })

  test("rollback without --confirm → none", () => {
    const out = planResume(
      task(),
      {
        workingTreeDirty: true,
        currentSha: "x",
        inReflog: true,
        taskStartedAtSha: "sha-1",
      },
      { mode: "rollback", confirm: false },
    )
    expect(out.kind).toBe("none")
  })

  test("rollback with confirm + startedAtSha in reflog → rollback", () => {
    const out = planResume(
      task(),
      {
        workingTreeDirty: true,
        currentSha: "x",
        inReflog: true,
        taskStartedAtSha: "sha-1",
      },
      { mode: "rollback", confirm: true },
    )
    expect(out.kind).toBe("rollback")
    if (out.kind === "rollback") expect(out.toSha).toBe("sha-1")
  })

  test("rollback when startedAtSha no longer in reflog → none", () => {
    const out = planResume(
      task(),
      {
        workingTreeDirty: true,
        currentSha: "x",
        inReflog: false,
        taskStartedAtSha: "sha-1",
      },
      { mode: "rollback", confirm: true },
    )
    expect(out.kind).toBe("none")
  })
})
