import { describe, expect, test } from "bun:test"
import { WorkspaceInfo } from "@coda/core/workspace"
import { sortWorkspaces } from "@coda/core/workspace/sidebar-helpers"

describe("sidebar workspace pure-logic helpers (B2)", () => {
  test("sortWorkspaces puts pinned first, then by uiOrder ascending", () => {
    const rows = [
      WorkspaceInfo.parse({
        id: "00000000-0000-0000-0000-000000000b01",
        projectId: "00000000-0000-0000-0000-000000000a01",
        name: "regular",
        cwd: "/tmp/a",
        baseBranch: "main",
        pinned: false,
        uiOrder: 100,
        createdAt: 0,
      }),
      WorkspaceInfo.parse({
        id: "00000000-0000-0000-0000-000000000b02",
        projectId: "00000000-0000-0000-0000-000000000a01",
        name: "pinned",
        cwd: "/tmp/b",
        baseBranch: "main",
        pinned: true,
        uiOrder: 200,
        createdAt: 0,
      }),
    ]
    const sorted = sortWorkspaces(rows)
    expect(sorted[0]?.name).toBe("pinned")
    expect(sorted[1]?.name).toBe("regular")
  })

  test("sortWorkspaces breaks uiOrder ties via recency then name", () => {
    const rows = [
      WorkspaceInfo.parse({
        id: "00000000-0000-0000-0000-000000000b10",
        projectId: "00000000-0000-0000-0000-000000000a01",
        name: "b-later",
        cwd: "/tmp/a",
        baseBranch: "main",
        pinned: false,
        uiOrder: 50,
        lastFocusedAt: 1000,
        createdAt: 0,
      }),
      WorkspaceInfo.parse({
        id: "00000000-0000-0000-0000-000000000b11",
        projectId: "00000000-0000-0000-0000-000000000a01",
        name: "a-earlier",
        cwd: "/tmp/b",
        baseBranch: "main",
        pinned: false,
        uiOrder: 50,
        lastFocusedAt: 500,
        createdAt: 0,
      }),
    ]
    const sorted = sortWorkspaces(rows)
    expect(sorted[0]?.name).toBe("b-later")
  })
})
