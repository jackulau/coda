import { Plus } from "lucide-solid"
import { type Component, For, Show } from "solid-js"
import { useLayout } from "../../context/layout"
import { useWorkspaces } from "../../context/workspace"
import { PortsPanel } from "./sidebar-ports"
import { ProjectGroup } from "./sidebar-project"

export const Sidebar: Component = () => {
  const layout = useLayout()
  const ws = useWorkspaces()

  const onAdd = () => {
    void ws.addWorkspaceFromDialog()
  }

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
        onClick={onAdd}
        style={{
          height: "36px",
          margin: "8px",
          "background-color": "transparent",
          color: "var(--text-secondary)",
          "border-radius": "6px",
          "font-size": "12px",
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          padding: "0 10px",
          transition: "background-color var(--motion-fast), color var(--motion-fast)",
          cursor: "pointer",
          border: "1px solid var(--border-default)",
        }}
        onMouseEnter={(e) => {
          const t = e.currentTarget
          t.style.backgroundColor = "var(--bg-2)"
          t.style.color = "var(--text-primary)"
        }}
        onMouseLeave={(e) => {
          const t = e.currentTarget
          t.style.backgroundColor = "transparent"
          t.style.color = "var(--text-secondary)"
        }}
      >
        <span style={{ display: "inline-flex", "align-items": "center", gap: "6px" }}>
          <Plus size={12} aria-hidden="true" />
          Open Folder…
        </span>
        <span style={{ color: "var(--text-tertiary)", "font-size": "11px" }}>⌘O</span>
      </button>
      <div style={{ flex: "1 1 auto", "overflow-y": "auto" }}>
        <Show
          when={ws.projects().length > 0}
          fallback={
            <div
              data-testid="sidebar-empty-state"
              style={{
                padding: "24px 16px",
                "text-align": "center",
                color: "var(--text-tertiary)",
                "font-size": "12px",
                display: "flex",
                "flex-direction": "column",
                gap: "12px",
              }}
            >
              <Show
                when={!ws.isLoading()}
                fallback={
                  <div
                    data-testid="sidebar-loading"
                    style={{ display: "flex", "flex-direction": "column", gap: "6px" }}
                  >
                    <div class="coda-skeleton-row" style={{ width: "70%" }} />
                    <div class="coda-skeleton-row" style={{ width: "85%" }} />
                    <div class="coda-skeleton-row" style={{ width: "60%" }} />
                  </div>
                }
              >
                <div>No workspace yet.</div>
                <button
                  type="button"
                  class="coda-btn-outlined"
                  data-testid="sidebar-empty-cta"
                  onClick={onAdd}
                  style={{ "align-self": "center" }}
                >
                  Open a folder
                </button>
                <Show when={ws.loadError()}>
                  {(err) => (
                    <div
                      data-testid="sidebar-load-error"
                      style={{ color: "var(--diff-remove)", "font-size": "11px" }}
                    >
                      {err()}
                    </div>
                  )}
                </Show>
              </Show>
            </div>
          }
        >
          <For each={ws.projects()}>{(p) => <ProjectGroup project={p} />}</For>
        </Show>
      </div>
      <PortsPanel />
    </aside>
  )
}
