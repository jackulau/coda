import type { Component } from "solid-js"
import { useLayout } from "../../context/layout"
import { ReviewChangesPanel } from "./review-changes"

/**
 * Right rail. Currently a "Review Changes" panel backed by an empty stub
 * (real git-status wiring lands in a follow-up). Layout survives an empty
 * change list by rendering a calm empty state rather than a dead panel.
 */
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
      <ReviewChangesPanel files={[]} />
    </aside>
  )
}
