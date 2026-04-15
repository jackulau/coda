import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { codaBus } from "../event/bus"
import type { WorkspaceInfo } from "./index"
import { WorkspaceStore } from "./store"

const seed = (overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo => ({
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  name: "test",
  cwd: "/tmp/test",
  baseBranch: "main",
  pinned: false,
  createdAt: Date.now(),
  ...overrides,
})

describe("WorkspaceStore", () => {
  beforeEach(() => {
    WorkspaceStore.clear()
    codaBus.removeAll()
  })

  afterEach(() => {
    WorkspaceStore.clear()
    codaBus.removeAll()
  })

  test("upsert + get round trip", () => {
    const w = seed({ name: "alpha" })
    WorkspaceStore.upsert(w)
    expect(WorkspaceStore.get(w.id)?.name).toBe("alpha")
  })

  test("update uiOrder emits Workspace.Updated", () => {
    const w = seed()
    WorkspaceStore.upsert(w)
    const events: number[] = []
    codaBus.on("Workspace.Updated", (e) => {
      if (e.uiOrder !== undefined) events.push(e.uiOrder)
    })
    WorkspaceStore.update(w.id, { uiOrder: 42 })
    expect(events).toEqual([42])
  })

  test("update lastFocusedAt is monotonic under concurrent writers", () => {
    const w = seed({ lastFocusedAt: 100 })
    WorkspaceStore.upsert(w)
    WorkspaceStore.update(w.id, { lastFocusedAt: 50 })
    expect(WorkspaceStore.get(w.id)?.lastFocusedAt).toBe(100)
    WorkspaceStore.update(w.id, { lastFocusedAt: 200 })
    expect(WorkspaceStore.get(w.id)?.lastFocusedAt).toBe(200)
  })

  test("update rejects NaN/Infinity uiOrder", () => {
    const w = seed()
    WorkspaceStore.upsert(w)
    expect(() => WorkspaceStore.update(w.id, { uiOrder: Number.NaN })).toThrow()
    expect(() => WorkspaceStore.update(w.id, { uiOrder: Number.POSITIVE_INFINITY })).toThrow()
  })

  test("update on missing workspace throws", () => {
    expect(() => WorkspaceStore.update("does-not-exist", { uiOrder: 1 })).toThrow(
      /workspace not found/,
    )
  })

  test("listByProject filters by projectId", () => {
    const p1 = crypto.randomUUID()
    const p2 = crypto.randomUUID()
    WorkspaceStore.upsert(seed({ projectId: p1, name: "a" }))
    WorkspaceStore.upsert(seed({ projectId: p1, name: "b" }))
    WorkspaceStore.upsert(seed({ projectId: p2, name: "c" }))
    expect(
      WorkspaceStore.listByProject(p1)
        .map((w) => w.name)
        .sort(),
    ).toEqual(["a", "b"])
    expect(WorkspaceStore.listByProject(p2).map((w) => w.name)).toEqual(["c"])
  })

  test("delete emits Workspace.Deleted exactly once", () => {
    const w = seed()
    WorkspaceStore.upsert(w)
    const events: string[] = []
    codaBus.on("Workspace.Deleted", (e) => events.push(e.id))
    expect(WorkspaceStore.delete(w.id)).toBe(true)
    expect(WorkspaceStore.delete(w.id)).toBe(false)
    expect(events).toEqual([w.id])
  })
})
