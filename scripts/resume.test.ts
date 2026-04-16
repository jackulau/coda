import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Tasks } from "../packages/core/src"
import { type GitSnapshot, plan, selectInProgress } from "./resume"

function freshState(tasks: Partial<Tasks.TaskEntry>[]): Tasks.TasksState {
  const s = new Tasks.TasksState()
  for (const over of tasks) {
    s.upsert({
      id: over.id ?? "A1",
      phase: "A",
      title: over.title ?? over.id ?? "t",
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
      ...over,
    })
  }
  return s
}

function git(over: Partial<GitSnapshot> = {}): GitSnapshot {
  return {
    currentSha: "abc",
    workingTreeDirty: false,
    inReflog: () => true,
    ...over,
  }
}

describe("resume plan()", () => {
  test("clean working tree + in_progress task → reset to pending", () => {
    const s = freshState([{ id: "A1", status: "in_progress" }])
    const action = plan({ mode: "continue", git: git({ workingTreeDirty: false }) }, s)
    expect(action.kind).toBe("mark-pending")
  })

  test("dirty working tree + --continue → keeps changes, re-runs verify", () => {
    const s = freshState([{ id: "A1", status: "in_progress" }])
    const action = plan({ mode: "continue", git: git({ workingTreeDirty: true }) }, s)
    expect(action.kind).toBe("continue")
  })

  test("--rollback without --confirm refuses", () => {
    const s = freshState([{ id: "A1", status: "in_progress" }])
    const action = plan(
      { mode: "rollback", confirm: false, git: git({ workingTreeDirty: true }) },
      s,
    )
    expect(action.kind).toBe("none")
  })

  test("--rollback --confirm with known startedAtSha resets HEAD to that sha", () => {
    const s = freshState([{ id: "A1", status: "in_progress", startedAtSha: "START_SHA" }])
    const action = plan(
      {
        mode: "rollback",
        confirm: true,
        git: git({ workingTreeDirty: true, inReflog: (sha) => sha === "START_SHA" }),
      },
      s,
    )
    expect(action.kind).toBe("rollback")
    if (action.kind === "rollback") {
      expect(action.toSha).toBe("START_SHA")
      expect(action.confirm).toBe(true)
    }
  })

  test("--abandon resets only task-listed files", () => {
    const s = freshState([{ id: "A1", status: "in_progress", files: ["a.ts", "b.ts"] }])
    const action = plan({ mode: "abandon", git: git({ workingTreeDirty: true }) }, s)
    expect(action.kind).toBe("abandon")
    if (action.kind === "abandon") {
      expect(action.files).toEqual(["a.ts", "b.ts"])
    }
  })
})

describe("selectInProgress", () => {
  test("single in_progress: returned directly", () => {
    const s = freshState([{ id: "A1", status: "in_progress" }])
    expect(selectInProgress(s, false)?.id).toBe("A1")
  })

  test("no in_progress: returns null", () => {
    const s = freshState([{ id: "A1", status: "pending" }])
    expect(selectInProgress(s, false)).toBeNull()
  })

  test("multiple in_progress without pickFirst: ambiguous → null", () => {
    const s = freshState([
      { id: "A1", status: "in_progress" },
      { id: "A2", status: "in_progress" },
    ])
    expect(selectInProgress(s, false)).toBeNull()
  })

  test("multiple in_progress with pickFirst: first by id order", () => {
    const s = freshState([
      { id: "A2", status: "in_progress" },
      { id: "A1", status: "in_progress" },
    ])
    expect(selectInProgress(s, true)?.id).toBe("A1")
  })

  test("explicit taskId selects that task regardless of status", () => {
    const s = freshState([
      { id: "A1", status: "pending" },
      { id: "A2", status: "in_progress" },
    ])
    expect(selectInProgress(s, false, "A1")?.id).toBe("A1")
  })
})

describe("edge cases", () => {
  test("startedAtSha not in reflog → rollback refuses", () => {
    const s = freshState([{ id: "A1", status: "in_progress", startedAtSha: "LOST_SHA" }])
    const action = plan(
      {
        mode: "rollback",
        confirm: true,
        git: git({ workingTreeDirty: true, inReflog: () => false }),
      },
      s,
    )
    expect(action.kind).toBe("none")
  })

  test("abandon on task with no files listed: returns empty file list (no-op)", () => {
    const s = freshState([{ id: "A1", status: "in_progress", files: [] }])
    const action = plan({ mode: "abandon", git: git({ workingTreeDirty: true }) }, s)
    expect(action.kind).toBe("abandon")
    if (action.kind === "abandon") expect(action.files).toEqual([])
  })
})
