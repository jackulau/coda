import type { Component } from "solid-js"
import { useLayout } from "../../context/layout"
import { ReviewChangesPanel } from "./review-changes"

/**
 * Right rail. Hosts the Review Changes panel. Hidden entirely when
 * `layout.state().rightRailVisible` is false — parent shell decides whether
 * to mount it; this component just renders the panel when mounted.
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
      <ReviewChangesPanel files={[]} onClose={() => layout.toggleRightRail()} />
    </aside>
  )
}
