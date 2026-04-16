import { cleanup, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { LayoutProvider } from "../../context/layout"
import { WorkspaceProvider } from "../../context/workspace"
import { PortsPanel } from "./sidebar-ports"

afterEach(cleanup)

describe("PortsPanel (H1)", () => {
  test("renders the ports panel region", () => {
    const { container } = render(() => (
      <WorkspaceProvider>
        <LayoutProvider>
          <PortsPanel />
        </LayoutProvider>
      </WorkspaceProvider>
    ))
    expect(container.querySelector("[data-testid='ports-panel']")).toBeTruthy()
  })

  test("demo data renders at least one known port", () => {
    const { container } = render(() => (
      <WorkspaceProvider>
        <LayoutProvider>
          <PortsPanel />
        </LayoutProvider>
      </WorkspaceProvider>
    ))
    expect(container.textContent).toContain("3000")
  })
})
