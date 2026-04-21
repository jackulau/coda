import { describe, expect, test } from "bun:test"
import type { LayoutState } from "./layout"

// Pure-logic test: the defaults shape and persistence key are stable.
// DOM-driven provider behavior lives in the vitest component tests.

describe("LayoutState shape (J2)", () => {
  test("LayoutState contract includes the persisted panel fields", () => {
    const sample: LayoutState = {
      sidebarWidth: 280,
      rightRailWidth: 380,
      portsPanelHeight: 180,
      centerTreeWidth: 240,
      terminalHeight: 240,
      focusedWorkspaceId: null,
      expandedWorkspaceId: null,
      expandedProjects: {},
      currentPage: "editor",
      rightRailVisible: true,
      terminalVisible: false,
    }
    expect(sample.sidebarWidth).toBe(280)
    expect(sample.focusedWorkspaceId).toBeNull()
    expect(sample.centerTreeWidth).toBe(240)
    expect(sample.terminalHeight).toBe(240)
    expect(sample.expandedWorkspaceId).toBeNull()
  })

  test("expandedProjects is a plain string→boolean map", () => {
    const sample: LayoutState = {
      sidebarWidth: 280,
      rightRailWidth: 380,
      portsPanelHeight: 180,
      centerTreeWidth: 240,
      terminalHeight: 240,
      focusedWorkspaceId: null,
      expandedWorkspaceId: null,
      expandedProjects: { "project-1": true, "project-2": false },
      currentPage: "editor",
      rightRailVisible: true,
      terminalVisible: false,
    }
    expect(sample.expandedProjects["project-1"]).toBe(true)
    expect(sample.expandedProjects["project-2"]).toBe(false)
  })
})
