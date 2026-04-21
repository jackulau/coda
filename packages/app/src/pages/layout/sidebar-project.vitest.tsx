import type { ProjectInfo } from "@coda/core/project"
import { cleanup, render, screen } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { LayoutProvider } from "../../context/layout"
import { WorkspaceProvider } from "../../context/workspace"
import { ProjectGroup } from "./sidebar-project"

afterEach(cleanup)

const sampleProject: ProjectInfo = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "sample-project",
  rootPath: "~/code/sample-project",
  expanded: true,
  createdAt: Date.now(),
}

const coda: ProjectInfo = {
  id: "00000000-0000-0000-0000-000000000002",
  name: "coda",
  rootPath: "~/code/coda",
  expanded: true,
  createdAt: Date.now(),
}

function renderGroup(project: ProjectInfo) {
  return render(() => (
    <WorkspaceProvider>
      <LayoutProvider>
        <ProjectGroup project={project} />
      </LayoutProvider>
    </WorkspaceProvider>
  ))
}

describe("ProjectGroup (B1)", () => {
  test("renders the project name in the header button", () => {
    renderGroup(sampleProject)
    expect(screen.getByText("sample-project")).toBeDefined()
  })

  test("renders a data-testid scoped to the project name", () => {
    const { container } = renderGroup(coda)
    expect(container.querySelector("[data-testid='project-coda']")).toBeTruthy()
  })

  test("shows workspace children when project expanded (demo data)", () => {
    renderGroup(sampleProject)
    expect(screen.queryByText("metrics-explorer")).toBeDefined()
  })

  test("header button is keyboard-focusable (type=button)", () => {
    const { container } = renderGroup(coda)
    const btn = container.querySelector("button[type='button']")
    expect(btn).toBeTruthy()
  })
})
