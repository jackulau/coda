import { type Component, Show } from "solid-js"
import { useWorkspaces } from "../../context/workspace"

/**
 * Title bar. The entire bar is a Tauri drag region (`data-tauri-drag-region`),
 * so users can move the window by grabbing anywhere except the traffic-light
 * reserved area on the left. Mouse events on descendants bubble up to the
 * drag region by default; interactive children (none here right now) would
 * need `data-tauri-drag-region="false"`.
 */
export const TitleBar: Component = () => {
  const ws = useWorkspaces()
  const focused = () => ws.workspaces().find((w) => w.id === ws.selectedId())
  const project = () =>
    focused() ? ws.projects().find((p) => p.id === focused()?.projectId) : undefined

  const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac")

  return (
    <header
      data-testid="title-bar"
      data-tauri-drag-region
      style={{
        height: "36px",
        display: "flex",
        "align-items": "center",
        "background-color": "var(--bg-1)",
        "border-bottom": "1px solid var(--border-subtle)",
        "user-select": "none",
        flex: "0 0 auto",
        position: "relative",
      }}
    >
      <Show when={isMac}>
        <div
          data-tauri-drag-region
          style={{ width: "78px", "padding-left": "14px" }}
          aria-hidden="true"
        />
      </Show>
      <div
        data-tauri-drag-region
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
        <Show when={project()} fallback={<span data-tauri-drag-region>Coda</span>}>
          {(p) => <span data-tauri-drag-region>{p().name}</span>}
        </Show>
      </div>
    </header>
  )
}
