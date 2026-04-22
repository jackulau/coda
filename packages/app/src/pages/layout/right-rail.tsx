import type { Component } from "solid-js"
import { ResizeHandle } from "../../components/resize-handle"
import { useGitStatus } from "../../context/git-status"
import { useLayout } from "../../context/layout"
import { useWorkspaces } from "../../context/workspace"
import { type ChangedFile as PanelChangedFile, ReviewChangesPanel } from "./review-changes"

/**
 * Right rail. Hosts the Review Changes panel. Hidden entirely when
 * `layout.state().rightRailVisible` is false — parent shell decides whether
 * to mount it; this component just renders the panel when mounted.
 *
 * File list comes from GitStatusProvider, which polls `git status`
 * + `git diff --numstat HEAD` every 3s (visible-tab only) and on workspace
 * switch. The status bar reads the same context so the two stay in sync.
 */
export const RightRail: Component = () => {
  const layout = useLayout()
  const git = useGitStatus()
  const ws = useWorkspaces()
  const focused = () => ws.workspaces().find((w) => w.id === ws.selectedId())
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
      <div
        style={{ flex: "1 1 auto", display: "flex", "flex-direction": "column", "min-width": 0 }}
      >
        <ReviewChangesPanel
          files={git.files() as unknown as PanelChangedFile[]}
          cwd={focused()?.cwd}
          onClose={() => layout.toggleRightRail()}
        />
      </div>
    </aside>
  )
}
