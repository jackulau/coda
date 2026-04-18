import type { Component } from "solid-js"
import { useLayout } from "../../context/layout"

/**
 * Right rail. A dedicated PR review surface lives here once the GitHub
 * integration ships (tracked in a separate spec). Until then the rail
 * shows a calm empty state — no disabled accent-colored buttons, no
 * leaked phase label. This matches the "no dead-end buttons" rule from
 * the polish spec.
 */
export const RightRail: Component = () => {
  const layout = useLayout()
  return (
    <aside
      data-testid="right-rail"
      style={{
        width: `${layout.state().rightRailWidth}px`,
        "min-width": "240px",
        "max-width": "480px",
        "background-color": "var(--bg-1)",
        "border-left": "1px solid var(--border-subtle)",
        display: "flex",
        "flex-direction": "column",
        flex: "0 0 auto",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          "border-bottom": "1px solid var(--border-subtle)",
          "font-size": "11px",
          color: "var(--text-tertiary)",
          "text-transform": "uppercase",
          "letter-spacing": "0.05em",
        }}
      >
        Inspector
      </div>
      <div
        data-testid="right-rail-empty"
        style={{
          flex: "1 1 auto",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          padding: "24px 16px",
          "text-align": "center",
          color: "var(--text-tertiary)",
          "font-size": "12px",
          "line-height": 1.5,
        }}
      >
        Select something to inspect it here.
      </div>
    </aside>
  )
}
