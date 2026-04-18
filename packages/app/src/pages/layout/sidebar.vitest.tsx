import { cleanup, render, waitFor } from "@solidjs/testing-library"
import { afterEach, describe, expect, test, vi } from "vitest"
import { LayoutProvider } from "../../context/layout"
import { WorkspaceProvider } from "../../context/workspace"
import { Sidebar } from "./sidebar"

afterEach(cleanup)

function renderSidebar(listWorkspaces = vi.fn().mockResolvedValue([])) {
  return render(() => (
    <LayoutProvider>
      <WorkspaceProvider
        ipc={{
          listWorkspaces,
          getLastSelectedWorkspace: vi.fn().mockResolvedValue(null),
        }}
      >
        <Sidebar />
      </WorkspaceProvider>
    </LayoutProvider>
  ))
}

describe("Sidebar polish (T11)", () => {
  test("empty_workspace_state_shows_cta", async () => {
    const { container } = renderSidebar()
    await waitFor(() =>
      expect(container.querySelector("[data-testid='sidebar-empty-cta']")).toBeTruthy(),
    )
    expect(container.querySelector("[data-testid='sidebar-empty-state']")).toBeTruthy()
    expect(container.textContent).toContain("No workspace yet")
  })

  test("loaded_workspaces_hide_cta", async () => {
    const { container } = renderSidebar(
      vi.fn().mockResolvedValue([{ id: "w-1", name: "ws1", rootPath: "/tmp/w1", addedAt: "0" }]),
    )
    await waitFor(() =>
      expect(container.querySelector("[data-testid='sidebar-empty-state']")).toBeNull(),
    )
  })

  test("loading_state_renders_loading_text", async () => {
    let resolve!: () => void
    const list = vi.fn().mockImplementation(
      () =>
        new Promise<[]>((r) => {
          resolve = () => r([])
        }),
    )
    const { container } = renderSidebar(list)
    await waitFor(() =>
      expect(container.querySelector("[data-testid='sidebar-loading']")).toBeTruthy(),
    )
    resolve()
  })

  test("open_folder_button_renders", async () => {
    const { container } = renderSidebar()
    await waitFor(() =>
      expect(container.querySelector("[data-testid='new-workspace-btn']")).toBeTruthy(),
    )
    expect(container.textContent).toContain("Open Folder")
  })
})
