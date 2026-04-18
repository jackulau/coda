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
      {/*
       * Non-mac platforms: the OS-native window decorations (enabled in
       * tauri.conf.json "decorations": true) already provide min/max/
       * close. Rendering fake title-bar buttons here duplicates the
       * chrome with non-functional handlers — the previous buttons had
       * no onClick wiring and were a visible dead-end per the polish
       * spec. Re-introduce this block once Tauri's window.current()
       * minimize/maximize/close calls are wired.
       */}
    </header>
  )
}
