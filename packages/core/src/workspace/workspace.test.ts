import { afterEach, describe, expect, test } from "bun:test"
import { codaBus } from "../event/bus"
import { WorkspaceInfo } from "./index"
import { WorkspaceStore } from "./store"

afterEach(() => WorkspaceStore.clear())

function makeWorkspace(overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo {
  return WorkspaceInfo.parse({
    id: overrides.id ?? "00000000-0000-0000-0000-000000000001",
    projectId: "00000000-0000-0000-0000-000000000010",
    name: "feature-x",
    cwd: "/tmp/feature-x",
    baseBranch: "main",
    createdAt: 1000,
    pinned: false,
    ...overrides,
  })
}

describe("workspace update() emits events with new order", () => {
  test("update uiOrder emits Workspace.Updated with new order", () => {
    const w = WorkspaceStore.upsert(makeWorkspace())
    const seen: unknown[] = []
    const off = codaBus.on("Workspace.Updated", (e) => seen.push(e))
    WorkspaceStore.update(w.id, { uiOrder: 42 })
    off()
    expect(seen.length).toBe(1)
    expect((seen[0] as { uiOrder: number }).uiOrder).toBe(42)
  })
})

describe("lastFocusedAt is monotonic under concurrent writers", () => {
  test("max of old+new wins regardless of arrival order", () => {
    const w = WorkspaceStore.upsert(makeWorkspace({ id: "00000000-0000-0000-0000-000000000002" }))
    WorkspaceStore.update(w.id, { lastFocusedAt: 1000 })
    // "concurrent" older write — should not clobber
    WorkspaceStore.update(w.id, { lastFocusedAt: 500 })
    const after = WorkspaceStore.get(w.id)
    expect(after?.lastFocusedAt).toBe(1000)
    // later write wins
    WorkspaceStore.update(w.id, { lastFocusedAt: 2000 })
    expect(WorkspaceStore.get(w.id)?.lastFocusedAt).toBe(2000)
  })
})

describe("migration preserves rows (round-trip via list())", () => {
  test("upsert + listByProject returns the same rows", () => {
    const w1 = WorkspaceStore.upsert(makeWorkspace({ id: "00000000-0000-0000-0000-000000000003" }))
    const w2 = WorkspaceStore.upsert(
      makeWorkspace({
        id: "00000000-0000-0000-0000-000000000004",
        name: "feature-y",
        cwd: "/tmp/feature-y",
      }),
    )
    const rows = WorkspaceStore.listByProject(w1.projectId)
    expect(rows.length).toBe(2)
    expect(rows.map((r) => r.id).sort()).toEqual([w1.id, w2.id].sort())
  })
})

describe("edge cases", () => {
  test("uiOrder = NaN rejects", () => {
    const w = WorkspaceStore.upsert(makeWorkspace({ id: "00000000-0000-0000-0000-000000000005" }))
    expect(() => WorkspaceStore.update(w.id, { uiOrder: Number.NaN })).toThrow(/finite/)
  })

  test("uiOrder = Infinity rejects", () => {
    const w = WorkspaceStore.upsert(makeWorkspace({ id: "00000000-0000-0000-0000-000000000006" }))
    expect(() => WorkspaceStore.update(w.id, { uiOrder: Number.POSITIVE_INFINITY })).toThrow(
      /finite/,
    )
  })

  test("update on missing workspace throws", () => {
    expect(() => WorkspaceStore.update("00000000-0000-0000-0000-000000000099", { uiOrder: 1 })).toThrow(
      /not found/,
    )
  })
})

describe("Workspace.Deleted emits on delete + removes row", () => {
  test("delete emits Workspace.Deleted and removes row", () => {
    const w = WorkspaceStore.upsert(makeWorkspace({ id: "00000000-0000-0000-0000-000000000007" }))
    const seen: unknown[] = []
    const off = codaBus.on("Workspace.Deleted", (e) => seen.push(e))
    const removed = WorkspaceStore.delete(w.id)
    off()
    expect(removed).toBe(true)
    expect(WorkspaceStore.get(w.id)).toBeUndefined()
    expect(seen.length).toBe(1)
  })
})
