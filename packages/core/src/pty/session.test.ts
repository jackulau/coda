import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { WorkspaceInfo } from "../workspace/index"
import { WorkspaceStore } from "../workspace/store"
import { ForeignKeyError, PtySessionStore, wirePtySessionCascade } from "./session-store"

const WORKSPACE_ID = "00000000-0000-0000-0000-000000000001"
const PROJECT_ID = "00000000-0000-0000-0000-000000000010"

function seedWorkspace(id = WORKSPACE_ID): void {
  WorkspaceStore.upsert(
    WorkspaceInfo.parse({
      id,
      projectId: PROJECT_ID,
      name: "feature",
      cwd: "/tmp/feature",
      baseBranch: "main",
      pinned: false,
      createdAt: 1000,
    }),
  )
}

beforeEach(() => {
  WorkspaceStore.clear()
  PtySessionStore.clear()
})

afterEach(() => {
  WorkspaceStore.clear()
  PtySessionStore.clear()
})

describe("PtySession create + get", () => {
  test("create round-trips via get()", () => {
    seedWorkspace()
    const row = PtySessionStore.create({
      workspaceId: WORKSPACE_ID,
      cwd: "/tmp/feature",
      title: "bash",
    })
    const got = PtySessionStore.get(row.id)
    expect(got?.title).toBe("bash")
    expect(got?.workspaceId).toBe(WORKSPACE_ID)
  })
})

describe("listByWorkspace returns stable order (startedAt asc)", () => {
  test("rows are sorted by startedAt ascending", async () => {
    seedWorkspace()
    const a = PtySessionStore.create({ workspaceId: WORKSPACE_ID, cwd: "/tmp", title: "A" })
    await new Promise((r) => setTimeout(r, 2))
    const b = PtySessionStore.create({ workspaceId: WORKSPACE_ID, cwd: "/tmp", title: "B" })
    const rows = PtySessionStore.listByWorkspace(WORKSPACE_ID)
    expect(rows.map((r) => r.id)).toEqual([a.id, b.id])
  })
})

describe("markExited sets code + timestamp", () => {
  test("markExited writes exitCode and exitedAt", () => {
    seedWorkspace()
    const row = PtySessionStore.create({ workspaceId: WORKSPACE_ID, cwd: "/tmp", title: "x" })
    const exited = PtySessionStore.markExited(row.id, 137)
    expect(exited.exitCode).toBe(137)
    expect(exited.exitedAt).toBeGreaterThan(0)
  })
})

describe("deleting workspace cascades sessions", () => {
  test("delete Workspace.Deleted → PtySessionStore.deleteByWorkspace", () => {
    const off = wirePtySessionCascade()
    try {
      seedWorkspace()
      PtySessionStore.create({ workspaceId: WORKSPACE_ID, cwd: "/tmp", title: "a" })
      PtySessionStore.create({ workspaceId: WORKSPACE_ID, cwd: "/tmp", title: "b" })
      expect(PtySessionStore.listByWorkspace(WORKSPACE_ID).length).toBe(2)
      WorkspaceStore.delete(WORKSPACE_ID)
      expect(PtySessionStore.listByWorkspace(WORKSPACE_ID).length).toBe(0)
    } finally {
      off()
    }
  })
})

describe("FK: create with non-existent workspaceId throws", () => {
  test("creating a session without seeding workspace throws ForeignKeyError", () => {
    expect(() =>
      PtySessionStore.create({
        workspaceId: "00000000-0000-0000-0000-000000000099",
        cwd: "/tmp",
        title: "x",
      }),
    ).toThrow(ForeignKeyError)
  })
})

describe("update after markExited still allowed (for bufferRef)", () => {
  test("updating title after exit still persists", () => {
    seedWorkspace()
    const row = PtySessionStore.create({ workspaceId: WORKSPACE_ID, cwd: "/tmp", title: "old" })
    PtySessionStore.markExited(row.id, 0)
    const updated = PtySessionStore.update(row.id, { title: "new" })
    expect(updated.title).toBe("new")
    // exit metadata still preserved
    expect(updated.exitCode).toBe(0)
    expect(updated.exitedAt).toBeGreaterThan(0)
  })
})
