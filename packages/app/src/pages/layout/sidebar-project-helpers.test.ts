import { describe, expect, test } from "bun:test"
import * as Sidebar from "@coda/core/workspace/sidebar-helpers"

// Helpers consumed by the sidebar ProjectGroup component. The pure-logic
// grouping + sort live in the core package; this file exists so the spec's
// `bun test src/pages/layout/sidebar-project-helpers.test.ts` filter is honored.

describe("sidebar project helpers (B1)", () => {
  test("groupWorkspacesByProject partitions workspaces into project buckets", () => {
    const projects = [
      { id: "p1", name: "One", rootPath: "/a", expanded: true, createdAt: 0 },
      { id: "p2", name: "Two", rootPath: "/b", expanded: true, createdAt: 0 },
    ]
    const workspaces = [
      { id: "a", projectId: "p1", name: "r1", cwd: "/", baseBranch: "main", pinned: false, createdAt: 0 },
      { id: "b", projectId: "p1", name: "r2", cwd: "/", baseBranch: "main", pinned: false, createdAt: 0 },
      { id: "c", projectId: "p2", name: "r3", cwd: "/", baseBranch: "main", pinned: false, createdAt: 0 },
    ]
    const grouped = Sidebar.groupWorkspacesByProject(projects, workspaces)
    const byProject = new Map(grouped.map((g) => [g.projectId, g]))
    expect(byProject.get("p1")?.workspaces.length).toBe(2)
    expect(byProject.get("p2")?.workspaces.length).toBe(1)
  })

  test("workspaces with unknown project id go to the UNASSIGNED bucket", () => {
    const workspaces = [
      { id: "x", projectId: "ghost", name: "x", cwd: "/", baseBranch: "main", pinned: false, createdAt: 0 },
    ]
    const grouped = Sidebar.groupWorkspacesByProject([], workspaces)
    expect(grouped.length).toBe(1)
    expect(grouped[0]?.projectId).toBe(Sidebar.UNASSIGNED_PROJECT_ID)
  })

  test("formatDiffCount rules: 0→null, >99999→'99k+', null→'—'", () => {
    expect(Sidebar.formatDiffCount(0)).toBeNull()
    expect(Sidebar.formatDiffCount(999)).toBe("999")
    expect(Sidebar.formatDiffCount(null)).toBe("—")
    expect(Sidebar.formatDiffCount(1_000_000)).toBe("99k+")
  })

  test("truncateName short-circuits when name is under max", () => {
    expect(Sidebar.truncateName("short", 10)).toBe("short")
    const truncated = Sidebar.truncateName("a-very-long-name-that-gets-cut", 10)
    expect(truncated.length).toBe(10)
    expect(truncated.endsWith("…")).toBe(true)
  })
})
