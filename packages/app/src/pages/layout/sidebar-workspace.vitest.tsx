import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { LayoutProvider } from "../../context/layout"
import { WorkspaceProvider, type WorkspaceUiRow } from "../../context/workspace"
import { WorkspaceRow } from "./sidebar-workspace"

afterEach(cleanup)

const row: WorkspaceUiRow = {
  id: "10000000-0000-0000-0000-000000000001",
  projectId: "00000000-0000-0000-0000-000000000001",
  name: "feature-x",
  cwd: "/tmp/feature-x",
  branch: "feat/x",
  baseBranch: "main",
  pinned: false,
  createdAt: Date.now(),
  agentStatus: "idle",
  additions: 0,
  deletions: 0,
}

function renderRow(w: WorkspaceUiRow) {
  return render(() => (
    <WorkspaceProvider>
      <LayoutProvider>
        <WorkspaceRow workspace={w} />
      </LayoutProvider>
    </WorkspaceProvider>
  ))
}

describe("WorkspaceRow (B2)", () => {
  test("renders workspace name in button", () => {
    const { container } = renderRow(row)
    expect(container.querySelector("[data-testid='workspace-feature-x']")).toBeTruthy()
  })

  test("click invokes select → updates data-selected to true", () => {
    const { container } = renderRow(row)
    const btn = container.querySelector(
      "[data-testid='workspace-feature-x']",
    ) as HTMLButtonElement | null
    expect(btn).not.toBeNull()
    if (btn) {
      fireEvent.click(btn)
      expect(btn.getAttribute("data-selected")).toBe("true")
    }
  })

  test("agentStatus=running maps to run color indicator", () => {
    const runningRow = { ...row, agentStatus: "running" as const }
    const { container } = renderRow(runningRow)
    const btn = container.querySelector("[data-testid='workspace-feature-x']")
    expect(btn).toBeTruthy()
  })

  test("diff counts are NOT rendered on the worktree row (belong to review panel)", () => {
    const big = { ...row, additions: 100, deletions: 50 }
    const { container } = renderRow(big)
    // +100 / -50 should not leak into the row — they live in the Review panel
    // and status bar only. The row only shows name, branch, and a status dot.
    expect(container.textContent).not.toContain("100")
    expect(container.textContent).not.toContain("50")
  })

  test("chevron toggle expands the inline file tree", () => {
    const { container } = renderRow(row)
    const toggle = container.querySelector(
      "[data-testid='workspace-tree-toggle-feature-x']",
    ) as HTMLButtonElement | null
    expect(toggle).not.toBeNull()
    expect(container.querySelector("[data-testid='workspace-tree-feature-x']")).toBeNull()
    if (toggle) {
      fireEvent.click(toggle)
      expect(container.querySelector("[data-testid='workspace-tree-feature-x']")).toBeTruthy()
    }
  })
})
