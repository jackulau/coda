import type { Component } from "solid-js"
import { useLayout } from "../../context/layout"

export const RightRail: Component = () => {
  const layout = useLayout()
  return (
    <aside
      data-testid="right-rail"
      style={{
        width: `${layout.state().rightRailWidth}px`,
        "min-width": "300px",
        "max-width": "560px",
        "background-color": "var(--bg-1)",
        "border-left": "1px solid var(--border-subtle)",
        display: "flex",
        "flex-direction": "column",
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          padding: "12px",
          display: "flex",
          "align-items": "center",
          gap: "8px",
          "border-bottom": "1px solid var(--border-subtle)",
        }}
      >
        <span style={{ color: "var(--text-primary)", "font-weight": 500, "font-size": "13px" }}>
          Review PR #—
        </span>
        <span
          style={{
            "margin-left": "auto",
            padding: "2px 8px",
            "background-color": "var(--accent-500)",
            color: "var(--bg-0)",
            "border-radius": "4px",
            "font-size": "10px",
            "font-weight": 700,
            "text-transform": "uppercase",
          }}
        >
          OPEN
        </span>
      </div>
      <div
        style={{
          flex: "1 1 auto",
          padding: "16px",
          color: "var(--text-tertiary)",
          "font-size": "12px",
        }}
      >
        Open a PR to begin review. (Phase E — Octokit client + diff viewer.)
      </div>
      <div
        style={{
          padding: "8px",
          "border-top": "1px solid var(--border-subtle)",
          display: "flex",
          gap: "8px",
        }}
      >
        <button
          type="button"
          disabled
          style={{
            flex: "1 1 auto",
            height: "32px",
            "background-color": "var(--diff-add)",
            color: "var(--bg-0)",
            "border-radius": "6px",
            "font-weight": 600,
            opacity: 0.5,
          }}
        >
          Approve
        </button>
        <button
          type="button"
          disabled
          style={{
            flex: "1 1 auto",
            height: "32px",
            "background-color": "var(--bg-2)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            "border-radius": "6px",
            "font-weight": 600,
            opacity: 0.5,
          }}
        >
          Comment
        </button>
      </div>
    </aside>
  )
}
