import { type Component, createEffect, createSignal, onCleanup, onMount } from "solid-js"
import { ResizeHandle } from "../../components/resize-handle"
import { useLayout } from "../../context/layout"
import { useWorkspaces } from "../../context/workspace"
import { listChangedFiles } from "../../lib/ipc"
import { type ChangedFile as PanelChangedFile, ReviewChangesPanel } from "./review-changes"

const POLL_MS = 3000

/**
 * Right rail. Hosts the Review Changes panel. Hidden entirely when
 * `layout.state().rightRailVisible` is false — parent shell decides whether
 * to mount it; this component just renders the panel when mounted.
 */
export const RightRail: Component = () => {
  const layout = useLayout()
  const ws = useWorkspaces()
  const [files, setFiles] = createSignal<PanelChangedFile[]>([])

  let timer: ReturnType<typeof setInterval> | null = null
  let cancelled = false

  const refresh = async () => {
    const sel = ws.workspaces().find((w) => w.id === ws.selectedId())
    if (!sel) {
      setFiles([])
      return
    }
    try {
      const raw = await listChangedFiles(sel.cwd)
      if (cancelled) return
      setFiles(raw as unknown as PanelChangedFile[])
    } catch {
      // Non-fatal: the panel will stay showing the last-known list.
      // Common cases: user opens a folder that isn't a git repo.
    }
  }

  onMount(() => {
    void refresh()
    timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh()
    }, POLL_MS)
  })
  onCleanup(() => {
    cancelled = true
    if (timer) clearInterval(timer)
  })

  createEffect(() => {
    ws.selectedId()
    void refresh()
  })

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
        <ReviewChangesPanel files={files()} onClose={() => layout.toggleRightRail()} />
      </div>
    </aside>
  )
}
