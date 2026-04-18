import { type Component, Show } from "solid-js"
import { EditorPanel } from "../../components/editor/editor-panel"
import { useBufferManager } from "../../components/editor/editor-panel"
import { useWorkspaces } from "../../context/workspace"
import { FileTreeLive } from "./file-tree"

export const CenterPanel: Component = () => {
  const ws = useWorkspaces()
  const mgr = useBufferManager()
  const focused = () => ws.workspaces().find((w) => w.id === ws.selectedId())

  return (
    <main
      data-testid="center-panel"
      style={{
        flex: "1 1 auto",
        display: "flex",
        "flex-direction": "row",
        "min-width": 0,
        "background-color": "var(--bg-0)",
      }}
    >
      <Show
        when={focused()}
        fallback={
          <div
            style={{
              flex: "1 1 auto",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              color: "var(--text-tertiary)",
            }}
          >
            Select a workspace from the sidebar.
          </div>
        }
      >
        {(w) => (
          <>
            <div
              data-testid="center-panel-tree"
              style={{
                width: "240px",
                "min-width": "200px",
                "border-right": "1px solid var(--border-subtle)",
                display: "flex",
                "flex-direction": "column",
              }}
            >
              <FileTreeLive
                rootPath={w().cwd}
                onOpenFile={(p) => {
                  void mgr.open(p).catch(() => {
                    /* toast wiring arrives in T9 */
                  })
                }}
              />
            </div>
            <EditorPanel />
          </>
        )}
      </Show>
    </main>
  )
}
