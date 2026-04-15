import { type Component, Show } from "solid-js"
import { useWorkspaces } from "../../context/workspace"

export const CenterPanel: Component = () => {
  const ws = useWorkspaces()
  const focused = () => ws.workspaces().find((w) => w.id === ws.selectedId())

  return (
    <main
      data-testid="center-panel"
      style={{
        flex: "1 1 auto",
        display: "flex",
        "flex-direction": "column",
        "min-width": 0,
        "background-color": "var(--bg-0)",
      }}
    >
      <div
        style={{
          height: "32px",
          "border-bottom": "1px solid var(--border-subtle)",
          "background-color": "var(--bg-1)",
          display: "flex",
          "align-items": "center",
          padding: "0 10px",
          gap: "12px",
          "font-size": "12px",
          color: "var(--text-secondary)",
        }}
      >
        <Show when={focused()} fallback={<span>Select a workspace from the sidebar.</span>}>
          {(w) => (
            <>
              <span style={{ color: "var(--text-primary)" }}>Terminal · {w().name}</span>
              <span style={{ color: "var(--text-tertiary)" }}>{w().branch}</span>
            </>
          )}
        </Show>
      </div>
      <div
        style={{
          flex: "1 1 auto",
          padding: "12px",
          "font-family": "var(--font-mono)",
          color: "var(--text-secondary)",
        }}
      >
        <Show when={focused()} fallback={<EmptyState />}>
          {(w) => (
            <pre style={{ margin: 0, "white-space": "pre-wrap" }}>
              {`$ cd ${w().cwd}
$ claude --resume
[claude] resumed session for ${w().name} on branch ${w().branch}
[claude] ready (terminal scaffold — PTY backend wired in Phase C)
`}
            </pre>
          )}
        </Show>
      </div>
      <div
        style={{
          padding: "8px",
          "background-color": "var(--bg-1)",
          "border-top": "1px solid var(--border-subtle)",
          display: "flex",
          gap: "8px",
        }}
      >
        <input
          type="text"
          placeholder="Type a task for Claude..."
          style={{
            flex: "1 1 auto",
            padding: "6px 10px",
            "background-color": "var(--bg-2)",
            border: "1px solid var(--border-default)",
            "border-radius": "6px",
            color: "var(--text-primary)",
            "font-family": "inherit",
            "font-size": "13px",
            outline: "none",
          }}
        />
        <button
          type="button"
          style={{
            padding: "6px 14px",
            "background-color": "var(--accent-500)",
            color: "var(--bg-0)",
            "border-radius": "6px",
            "font-weight": 600,
            "font-size": "12px",
          }}
        >
          ⏎ Send
        </button>
      </div>
    </main>
  )
}

const EmptyState: Component = () => (
  <div
    style={{
      height: "100%",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      color: "var(--text-tertiary)",
    }}
  >
    Select a workspace from the sidebar.
  </div>
)
