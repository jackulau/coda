import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { codaBus } from "../event/bus"
import type { WorkspaceInfo } from "../workspace"
import { WorkspaceStore } from "../workspace/store"
import { ForeignKeyError, PtySessionStore, wirePtySessionCascade } from "./session-store"

const ws = (overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo => ({
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  name: "ws",
  cwd: "/tmp",
  baseBranch: "main",
  pinned: false,
  createdAt: Date.now(),
  ...overrides,
})

describe("PtySessionStore", () => {
  beforeEach(() => {
    PtySessionStore.clear()
    WorkspaceStore.clear()
    codaBus.removeAll()
    wirePtySessionCascade()
  })

  afterEach(() => {
    PtySessionStore.clear()
    WorkspaceStore.clear()
    codaBus.removeAll()
  })

  test("create + get round-trip", () => {
    const w = WorkspaceStore.upsert(ws())
    const s = PtySessionStore.create({
      workspaceId: w.id,
      cwd: "/work",
      title: "shell",
    })
    expect(PtySessionStore.get(s.id)).toEqual(s)
  })

  test("listByWorkspace returns stable startedAt order", async () => {
    const w = WorkspaceStore.upsert(ws())
    const a = PtySessionStore.create({ workspaceId: w.id, cwd: "/a", title: "a" })
    await new Promise((r) => setTimeout(r, 5))
    const b = PtySessionStore.create({ workspaceId: w.id, cwd: "/b", title: "b" })
    expect(PtySessionStore.listByWorkspace(w.id).map((s) => s.id)).toEqual([a.id, b.id])
  })

  test("markExited sets exitCode + exitedAt + emits", () => {
    const w = WorkspaceStore.upsert(ws())
    const s = PtySessionStore.create({ workspaceId: w.id, cwd: "/x", title: "x" })
    const events: Array<{ id: string; code: number }> = []
    codaBus.on("PtySession.Exited", (e) => events.push({ id: e.id, code: e.exitCode }))
    const after = PtySessionStore.markExited(s.id, 137)
    expect(after.exitCode).toBe(137)
    expect(after.exitedAt).toBeGreaterThanOrEqual(s.startedAt)
    expect(events).toEqual([{ id: s.id, code: 137 }])
  })

  test("creating session for missing workspace throws ForeignKeyError", () => {
    expect(() =>
      PtySessionStore.create({ workspaceId: crypto.randomUUID(), cwd: "/x", title: "x" }),
    ).toThrow(ForeignKeyError)
  })

  test("deleting workspace cascades to sessions", () => {
    const w = WorkspaceStore.upsert(ws())
    PtySessionStore.create({ workspaceId: w.id, cwd: "/x", title: "x" })
    PtySessionStore.create({ workspaceId: w.id, cwd: "/y", title: "y" })
    expect(PtySessionStore.listByWorkspace(w.id)).toHaveLength(2)
    WorkspaceStore.delete(w.id)
    expect(PtySessionStore.listByWorkspace(w.id)).toHaveLength(0)
  })

  test("update after markExited still allowed", () => {
    const w = WorkspaceStore.upsert(ws())
    const s = PtySessionStore.create({ workspaceId: w.id, cwd: "/x", title: "x" })
    PtySessionStore.markExited(s.id, 0)
    const out = PtySessionStore.update(s.id, { claudeSessionId: "new-buf" })
    expect(out.claudeSessionId).toBe("new-buf")
    expect(out.exitCode).toBe(0)
  })
})
