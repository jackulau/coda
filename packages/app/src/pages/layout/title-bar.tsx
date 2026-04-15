import { type Component, Show } from "solid-js"
import { useWorkspaces } from "../../context/workspace"

export const TitleBar: Component = () => {
  const ws = useWorkspaces()
  const focused = () => ws.workspaces().find((w) => w.id === ws.selectedId())
  const project = () =>
    focused() ? ws.projects().find((p) => p.id === focused()?.projectId) : undefined

  const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac")

  return (
    <header
      data-testid="title-bar"
      style={{
        height: "36px",
        display: "flex",
        "align-items": "center",
        "background-color": "var(--bg-1)",
        "user-select": "none",
        flex: "0 0 auto",
        position: "relative",
      }}
    >
      <Show when={isMac}>
        <div style={{ width: "78px", "padding-left": "14px" }} aria-hidden="true" />
      </Show>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "pointer-events": "none",
          color: "var(--text-secondary)",
          "font-size": "12px",
        }}
      >
        <Show when={project()}>{(p) => <span>{p().name}</span>}</Show>
      </div>
      <Show when={!isMac}>
        <div style={{ "margin-left": "auto", display: "flex", gap: "4px", "padding-right": "8px" }}>
          <button type="button" aria-label="minimize" style={{ width: "28px", height: "28px" }}>
            ─
          </button>
          <button type="button" aria-label="maximize" style={{ width: "28px", height: "28px" }}>
            ▢
          </button>
          <button type="button" aria-label="close" style={{ width: "28px", height: "28px" }}>
            ×
          </button>
        </div>
      </Show>
    </header>
  )
}
