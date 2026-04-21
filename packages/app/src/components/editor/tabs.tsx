import { File as FileIcon, X } from "lucide-solid"
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
        height: "36px",
        "align-items": "stretch",
        "overflow-x": "auto",
      }}
    >
      <For each={props.buffers}>
        {(b) => {
          const isActive = () => props.activePath === b.path
          return (
            <div
              class="coda-hover-parent"
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
                "border-bottom": `2px solid ${isActive() ? "var(--accent-500)" : "transparent"}`,
                "font-size": "12px",
                color: isActive() ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer",
                transition:
                  "background-color var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast)",
              }}
              onClick={() => props.onFocus(b.path)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  props.onFocus(b.path)
                }
              }}
            >
              <FileIcon size={12} aria-hidden="true" style={{ opacity: 0.7 }} />
              <span>{basename(b.path)}</span>
              {b.dirty && (
                <span
                  data-testid={`editor-tab-dirty-${b.path}`}
                  style={{
                    width: "8px",
                    height: "8px",
                    "border-radius": "50%",
                    "background-color": "rgba(232, 232, 236, 0.85)",
                  }}
                />
              )}
              <button
                type="button"
                class="coda-hover-reveal"
                data-testid={`editor-tab-close-${b.path}`}
                onClick={(e) => {
                  e.stopPropagation()
                  props.onClose(b.path)
                }}
                style={{
                  display: "inline-flex",
                  "align-items": "center",
                  "justify-content": "center",
                  width: "16px",
                  height: "16px",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                  padding: 0,
                  "border-radius": "3px",
                }}
                aria-label={`Close ${basename(b.path)}`}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </div>
          )
        }}
      </For>
    </div>
  )
}
