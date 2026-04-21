import type { Component } from "solid-js"
import { ResizeHandle } from "../../components/resize-handle"
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
        "flex-direction": "row",
        flex: "0 0 auto",
        position: "relative",
      }}
    >
      <ResizeHandle
        direction="horizontal"
        ariaLabel="Resize review panel"
        testId="right-rail-resize-handle"
        onDrag={(d) => layout.setRightRailWidth(layout.state().rightRailWidth - d)}
        onNudge={(d) => layout.setRightRailWidth(layout.state().rightRailWidth - d)}
      />
      <div style={{ flex: "1 1 auto", display: "flex", "flex-direction": "column", "min-width": 0 }}>
        <ReviewChangesPanel files={[]} onClose={() => layout.toggleRightRail()} />
      </div>
    </aside>
  )
}
