import { describe, expect, test } from "bun:test"
import { planReattach, type PtySessionSnapshot } from "../pty-reattach/reattach"

function session(over: Partial<PtySessionSnapshot> = {}): PtySessionSnapshot {
  return {
    id: "s1",
    workspaceId: "w1",
    cwd: "/tmp",
    shell: "bash",
    exitedAt: null,
    exitCode: null,
    claudeSessionId: null,
    ...over,
  }
}

describe("planReattach across sidecar restart", () => {
  test("live session with existing cwd → reattach", () => {
    const plan = planReattach([session()], { cwdExists: () => true })
    expect(plan).toEqual([
      { kind: "reattach", id: "s1", workspaceId: "w1", cwd: "/tmp", shell: "bash" },
    ])
  })

  test("exited session with code 0 → history (clean-exit)", () => {
    const plan = planReattach([session({ exitedAt: 1000, exitCode: 0 })], { cwdExists: () => true })
    expect(plan[0]).toMatchObject({ kind: "history", reason: "clean-exit" })
  })

  test("exited session with non-zero code → history (crashed)", () => {
    const plan = planReattach([session({ exitedAt: 1000, exitCode: 137 })], { cwdExists: () => true })
    expect(plan[0]).toMatchObject({ kind: "history", reason: "crashed" })
  })

  test("cwd no longer exists → failed (cwd-missing)", () => {
    const plan = planReattach([session({ cwd: "/gone" })], { cwdExists: (p) => p !== "/gone" })
    expect(plan[0]).toMatchObject({ kind: "failed", reason: "cwd-missing" })
  })

  test("workspace deleted → failed (workspace-deleted)", () => {
    const plan = planReattach([session({ workspaceId: "gone" })], {
      cwdExists: () => true,
      workspaceExists: (id) => id !== "gone",
    })
    expect(plan[0]).toMatchObject({ kind: "failed", reason: "workspace-deleted" })
  })

  test("mix of live, exited, and deleted sessions preserves input order", () => {
    const plan = planReattach(
      [
        session({ id: "a" }),
        session({ id: "b", exitedAt: 1, exitCode: 0 }),
        session({ id: "c", workspaceId: "gone" }),
      ],
      { cwdExists: () => true, workspaceExists: (id) => id !== "gone" },
    )
    expect(plan.map((p) => p.id)).toEqual(["a", "b", "c"])
  })
})
