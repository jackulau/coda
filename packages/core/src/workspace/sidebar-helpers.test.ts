import { describe, expect, test } from "bun:test"
import type { ProjectInfo } from "../project"
import type { WorkspaceInfo } from "./index"
import {
  UNASSIGNED_PROJECT_ID,
  formatDiffCount,
  groupWorkspacesByProject,
  sortWorkspaces,
  truncateName,
} from "./sidebar-helpers"

const proj = (overrides: Partial<ProjectInfo> = {}): ProjectInfo => ({
  id: crypto.randomUUID(),
  name: "p",
  rootPath: "/p",
  expanded: true,
  createdAt: 0,
  ...overrides,
})

const ws = (overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo => ({
  id: crypto.randomUUID(),
  projectId: crypto.randomUUID(),
  name: "w",
  cwd: "/w",
  baseBranch: "main",
  pinned: false,
  createdAt: 0,
  ...overrides,
})

describe("groupWorkspacesByProject", () => {
  test("orphaned workspaces land in __unassigned", () => {
    const p1 = proj({ name: "alpha", uiOrder: 0 })
    const w1 = ws({ projectId: p1.id, name: "in-alpha" })
    const w2 = ws({ projectId: "ghost", name: "orphan" })
    const groups = groupWorkspacesByProject([p1], [w1, w2])
    expect(groups[0]?.projectId).toBe(p1.id)
    expect(groups[0]?.workspaces.map((w) => w.name)).toEqual(["in-alpha"])
    expect(groups[1]?.projectId).toBe(UNASSIGNED_PROJECT_ID)
    expect(groups[1]?.workspaces.map((w) => w.name)).toEqual(["orphan"])
  })

  test("projects sort by uiOrder then name", () => {
    const a = proj({ name: "z", uiOrder: 0 })
    const b = proj({ name: "a", uiOrder: 1 })
    const wa = ws({ projectId: a.id })
    const wb = ws({ projectId: b.id })
    const out = groupWorkspacesByProject([b, a], [wb, wa])
    expect(out.map((g) => g.project?.name)).toEqual(["z", "a"])
  })
})

describe("sortWorkspaces", () => {
  test("pinned first, then uiOrder asc, then lastFocusedAt desc", () => {
    const out = sortWorkspaces([
      ws({ name: "c", pinned: false, uiOrder: 2 }),
      ws({ name: "a", pinned: true, uiOrder: 1 }),
      ws({ name: "b", pinned: true, uiOrder: 0 }),
      ws({ name: "d", pinned: false, uiOrder: 2, lastFocusedAt: 100 }),
      ws({ name: "e", pinned: false, uiOrder: 1, lastFocusedAt: 50 }),
    ])
    expect(out.map((w) => w.name)).toEqual(["b", "a", "e", "d", "c"])
  })

  test("name tiebreak when everything else equal", () => {
    const out = sortWorkspaces([ws({ name: "zeta" }), ws({ name: "alpha" }), ws({ name: "mu" })])
    expect(out.map((w) => w.name)).toEqual(["alpha", "mu", "zeta"])
  })
})

describe("formatDiffCount", () => {
  test("null/undefined → em dash", () => {
    expect(formatDiffCount(null)).toBe("—")
    expect(formatDiffCount(undefined)).toBe("—")
  })
  test("zero → no badge", () => {
    expect(formatDiffCount(0)).toBe(null)
  })
  test("normal numbers", () => {
    expect(formatDiffCount(7)).toBe("7")
    expect(formatDiffCount(1234)).toBe("1234")
  })
  test("99k+ ceiling", () => {
    expect(formatDiffCount(99_999)).toBe("99999")
    expect(formatDiffCount(100_000)).toBe("99k+")
    expect(formatDiffCount(2_000_000)).toBe("99k+")
  })
})

describe("truncateName", () => {
  test("returns original when under max", () => {
    expect(truncateName("short", 32)).toBe("short")
  })
  test("ellipsizes when over", () => {
    const long = "a".repeat(120)
    const out = truncateName(long, 32)
    expect(out.endsWith("…")).toBe(true)
    expect(out.length).toBe(32)
  })
})
