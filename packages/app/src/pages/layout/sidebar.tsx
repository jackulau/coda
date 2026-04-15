import { type Component, For } from "solid-js"
import { useLayout } from "../../context/layout"
import { useWorkspaces } from "../../context/workspace"
import { PortsPanel } from "./sidebar-ports"
import { ProjectGroup } from "./sidebar-project"

export const Sidebar: Component = () => {
  const layout = useLayout()
  const ws = useWorkspaces()

  return (
    <aside
      data-testid="sidebar"
      style={{
        width: `${layout.state().sidebarWidth}px`,
        "min-width": "220px",
        "max-width": "400px",
        "background-color": "var(--bg-1)",
        "border-right": "1px solid var(--border-subtle)",
        display: "flex",
        "flex-direction": "column",
        flex: "0 0 auto",
      }}
    >
      <button
        type="button"
        data-testid="new-workspace-btn"
        style={{
          height: "36px",
          margin: "8px",
          "background-color": "var(--bg-2)",
          color: "var(--text-secondary)",
          "border-radius": "6px",
          "font-size": "12px",
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "0 10px",
          transition: "background-color var(--motion-fast)",
        }}
      >
        <span>
          <span style={{ color: "var(--accent-500)", "margin-right": "6px" }}>+</span>
          New Workspace
        </span>
        <span style={{ color: "var(--text-tertiary)", "font-size": "11px" }}>⌘N</span>
      </button>
      <div style={{ flex: "1 1 auto", "overflow-y": "auto" }}>
        <For each={ws.projects()}>{(p) => <ProjectGroup project={p} />}</For>
      </div>
      <PortsPanel />
    </aside>
  )
}
