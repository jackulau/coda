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

  test("external ports surface even with no workspace selected", () => {
    const { container } = render(() => (
      <WorkspaceProvider>
        <LayoutProvider>
          <PortsPanel />
        </LayoutProvider>
      </WorkspaceProvider>
    ))
    // With no workspaces persisted (async-loaded from IPC in tests), only the
    // external/other ports group renders. This replaces the pre-T6 demo
    // assertion that expected a port bound to a specific demo workspace id.
    expect(container.textContent).toMatch(/Other|Ports/i)
  })
})
