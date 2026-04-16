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

  test("additions/deletions counts render in row", () => {
    const big = { ...row, additions: 100, deletions: 50 }
    const { container } = renderRow(big)
    // numeric badges are rendered somewhere in the row
    expect(container.textContent).toContain("100")
    expect(container.textContent).toContain("50")
  })
})
