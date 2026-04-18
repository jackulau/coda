import { type Component, For } from "solid-js"
import type { Buffer } from "./buffer-manager"

export interface TabsProps {
  buffers: Buffer[]
  activePath: string | null
  onFocus: (path: string) => void
  onClose: (path: string) => void
}

function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
  const tail = i >= 0 ? path.slice(i + 1) : path
  // Path ending in "/" (root or trailing slash) would give an empty
  // string; fall back to the full path so the tab always has a label.
  return tail || path || "untitled"
}

export const Tabs: Component<TabsProps> = (props) => {
  return (
    <div
      data-testid="editor-tabs"
      style={{
        display: "flex",
        "flex-direction": "row",
        "border-bottom": "1px solid var(--border-subtle)",
        "background-color": "var(--bg-1)",
        height: "32px",
        "align-items": "stretch",
        "overflow-x": "auto",
      }}
    >
      <For each={props.buffers}>
        {(b) => {
          const isActive = () => props.activePath === b.path
          return (
            <div
              data-testid={`editor-tab-${b.path}`}
              data-active={isActive() ? "true" : "false"}
              data-dirty={b.dirty ? "true" : "false"}
              role="tab"
              tabIndex={isActive() ? 0 : -1}
              aria-selected={isActive()}
              style={{
                display: "flex",
                "align-items": "center",
                padding: "0 10px",
                gap: "6px",
                "background-color": isActive() ? "var(--bg-0)" : "transparent",
                "border-right": "1px solid var(--border-subtle)",
                "font-size": "12px",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
              onClick={() => props.onFocus(b.path)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  props.onFocus(b.path)
                }
              }}
            >
              <span>{basename(b.path)}</span>
              {b.dirty && (
                <span
                  data-testid={`editor-tab-dirty-${b.path}`}
                  style={{
                    width: "8px",
                    height: "8px",
                    "border-radius": "50%",
                    "background-color": "var(--accent-500)",
                  }}
                />
              )}
              <button
                type="button"
                data-testid={`editor-tab-close-${b.path}`}
                onClick={(e) => {
                  e.stopPropagation()
                  props.onClose(b.path)
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-tertiary)",
                  "font-size": "14px",
                  cursor: "pointer",
                  padding: "0 4px",
                }}
                aria-label={`Close ${basename(b.path)}`}
              >
                ×
              </button>
            </div>
          )
        }}
      </For>
    </div>
  )
}
