import { type Component, Show, createContext, createMemo, useContext } from "solid-js"
import { readTextFile, writeTextFile } from "../../lib/ipc"
import { type BufferManager, createBufferManager } from "./buffer-manager"
import { Editor } from "./editor"
import { Tabs } from "./tabs"

/**
 * Provider that owns the BufferManager and exposes open/save/close so
 * components outside the editor pane (e.g. the file tree, command
 * palette) can trigger the same operations.
 */
const BufferCtx = createContext<BufferManager>()

export interface EditorPanelProviderProps {
  children?: import("solid-js").JSX.Element
  /** @internal test hook */
  reader?: (path: string) => Promise<string>
  /** @internal test hook */
  writer?: (path: string, contents: string) => Promise<void>
}

export const EditorPanelProvider: Component<EditorPanelProviderProps> = (props) => {
  const mgr = createBufferManager({
    reader: props.reader ?? readTextFile,
    writer: props.writer ?? writeTextFile,
  })
  return <BufferCtx.Provider value={mgr}>{props.children}</BufferCtx.Provider>
}

export function useBufferManager(): BufferManager {
  const v = useContext(BufferCtx)
  if (!v) throw new Error("useBufferManager must be used within EditorPanelProvider")
  return v
}

export const EditorPanel: Component = () => {
  const mgr = useBufferManager()
  const active = createMemo(() => {
    const id = mgr.active()
    return id ? (mgr.buffers().find((b) => b.path === id) ?? null) : null
  })
  return (
    <div
      data-testid="editor-panel"
      style={{
        flex: "1 1 auto",
        display: "flex",
        "flex-direction": "column",
        "min-height": 0,
      }}
    >
      <Show
        when={mgr.buffers().length > 0}
        fallback={
          <div
            data-testid="editor-panel-empty"
            style={{
              flex: "1 1 auto",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              color: "var(--text-tertiary)",
              "font-size": "12px",
            }}
          >
            Open a file from the tree to begin editing.
          </div>
        }
      >
        <Tabs
          buffers={mgr.buffers()}
          activePath={mgr.active()}
          onFocus={(p) => mgr.focus(p)}
          onClose={(p) => {
            const ok = mgr.close(p)
            if (!ok) {
              const confirmed =
                typeof window !== "undefined"
                  ? window.confirm(`${p} has unsaved changes. Close anyway?`)
                  : false
              if (confirmed) mgr.close(p, true)
            }
          }}
        />
        <Show when={active()}>
          {(b) => (
            <Editor
              path={b().path}
              content={b().content}
              onChange={(v) => mgr.update(b().path, v)}
              onSave={() => {
                void mgr.save(b().path).catch(() => {
                  /* toast wiring arrives in T9 */
                })
              }}
            />
          )}
        </Show>
      </Show>
    </div>
  )
}
