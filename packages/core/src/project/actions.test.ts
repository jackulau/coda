import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { codaBus } from "../event/bus"
import { cloneAsWorktree, removeProject, renameProject, revealProject } from "./actions"
import type { ProjectInfo } from "./index"
import { ProjectStore } from "./store"

const seed = (overrides: Partial<ProjectInfo> = {}): ProjectInfo => ({
  id: crypto.randomUUID(),
  name: "demo",
  rootPath: "/tmp/demo",
  expanded: true,
  createdAt: 0,
  ...overrides,
})

const io = {
  exists: async (p: string) => p === "/tmp/demo",
  reveal: async () => undefined,
  cloneWorktree: async ({ newName }: { newName: string; rootPath: string; baseBranch: string }) =>
    `/tmp/worktrees/${newName}`,
}

beforeEach(() => {
  ProjectStore.clear()
  codaBus.removeAll()
})
afterEach(() => {
  ProjectStore.clear()
  codaBus.removeAll()
})

describe("renameProject", () => {
  test("renames and returns new name", async () => {
    const p = ProjectStore.upsert(seed({ name: "old" }))
    const out = await renameProject(p.id, "new-name")
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.value.name).toBe("new-name")
    expect(ProjectStore.get(p.id)?.name).toBe("new-name")
  })

  test("rejects empty name", async () => {
    const p = ProjectStore.upsert(seed())
    const out = await renameProject(p.id, "   ")
    expect(out.ok).toBe(false)
  })

  test("missing project → not-found", async () => {
    const out = await renameProject(crypto.randomUUID(), "x")
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe("not-found")
  })
})

describe("removeProject", () => {
  test("removes existing project", async () => {
    const p = ProjectStore.upsert(seed())
    const out = await removeProject(p.id)
    expect(out.ok).toBe(true)
    expect(ProjectStore.get(p.id)).toBeUndefined()
  })
})

describe("revealProject", () => {
  test("reveals when root exists", async () => {
    const p = ProjectStore.upsert(seed({ rootPath: "/tmp/demo" }))
    const out = await revealProject(p.id, io)
    expect(out.ok).toBe(true)
  })
  test("missing on disk → missing-on-disk code", async () => {
    const p = ProjectStore.upsert(seed({ rootPath: "/does-not-exist" }))
    const out = await revealProject(p.id, io)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe("missing-on-disk")
  })
})

describe("cloneAsWorktree", () => {
  test("clones with safe name", async () => {
    const p = ProjectStore.upsert(seed())
    const out = await cloneAsWorktree(p.id, "feat-x", "main", io)
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.value.path).toBe("/tmp/worktrees/feat-x")
  })
  test("rejects unsafe name", async () => {
    const p = ProjectStore.upsert(seed())
    const out = await cloneAsWorktree(p.id, "has spaces!", "main", io)
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.code).toBe("invalid-name")
  })
  test("io failure propagates as clone-failed", async () => {
    const p = ProjectStore.upsert(seed())
    const badIo = { ...io, cloneWorktree: async () => Promise.reject(new Error("disk full")) }
    const out = await cloneAsWorktree(p.id, "ok-name", "main", badIo)
    expect(out.ok).toBe(false)
    if (!out.ok) {
      expect(out.code).toBe("clone-failed")
      expect(out.message).toBe("disk full")
    }
  })
})
