import { Palette } from "@coda/core"
import { FileCode, FileJson, FileText, FileType, Hash, Terminal as TermIcon } from "lucide-solid"
import { type Component, For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"

export interface PaletteCommand {
  id: string
  label: string
  hint?: string
  run: () => void
}

interface Props {
  commands: PaletteCommand[]
  files?: string[]
  open: () => boolean
  onClose: () => void
  onOpenFile?: (path: string) => void
}

type Mode = "files" | "commands"

const EXT_ICONS: Record<string, Component<{ size: number; style?: Record<string, string> }>> = {
  ts: FileCode,
  tsx: FileCode,
  js: FileCode,
  jsx: FileCode,
  rs: FileCode,
  py: FileCode,
  go: FileCode,
  json: FileJson,
  md: FileText,
  txt: FileText,
  toml: FileType,
  yaml: FileType,
  yml: FileType,
  sh: TermIcon,
  css: Hash,
}

function fileIcon(path: string): Component<{ size: number; style?: Record<string, string> }> {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  return EXT_ICONS[ext] ?? FileText
}

function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
  return i >= 0 ? path.slice(i + 1) : path
}

function dirname(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
  return i > 0 ? path.slice(0, i) : ""
}

export const CommandPalette: Component<Props> = (props) => {
  const [query, setQuery] = createSignal("")
  const [activeIndex, setActiveIndex] = createSignal(0)

  const mode = (): Mode => (query().startsWith(">") ? "commands" : "files")

  const commandQuery = () => (mode() === "commands" ? query().slice(1).trim() : query())

  const rankedCommands = createMemo(() =>
    Palette.rank(props.commands, commandQuery(), (c) => `${c.label} ${c.id}`).slice(0, 50),
  )

  const rankedFiles = createMemo(() => {
    const q = query().trim()
    if (!q || mode() === "commands") return []
    const allFiles = props.files ?? []
    if (allFiles.length === 0) return []
    return Palette.rank(
      allFiles.map((f) => ({ path: f })),
      q,
      (item) => item.path,
    ).slice(0, 50)
  })

  const totalItems = () => (mode() === "commands" ? rankedCommands().length : rankedFiles().length)

  const onKeyDown = (e: KeyboardEvent) => {
    if (!props.open()) return
    if (e.key === "Escape") {
      e.preventDefault()
      props.onClose()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, totalItems() - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (mode() === "commands") {
        const r = rankedCommands()[activeIndex()]
        if (r) {
          r.item.run()
          props.onClose()
        }
      } else {
        const r = rankedFiles()[activeIndex()]
        if (r) {
          props.onOpenFile?.(r.item.path)
          props.onClose()
        }
      }
    }
  }

  onMount(() => {
    window.addEventListener("keydown", onKeyDown)
  })
  onCleanup(() => {
    window.removeEventListener("keydown", onKeyDown)
  })

  const modeLabel = () => (mode() === "commands" ? "Commands" : "Files")

  return (
    <Show when={props.open()}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled at window level */}
      <div
        data-testid="command-palette-overlay"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          "justify-content": "center",
          "padding-top": "100px",
          "z-index": 100,
        }}
        onClick={props.onClose}
      >
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled at window level */}
        {/* biome-ignore lint/a11y/useSemanticElements: dialog role on div is required for portal */}
        <div
          role="dialog"
          aria-label="Command palette"
          style={{
            width: "560px",
            "max-width": "90vw",
            background: "var(--bg-2)",
            border: "1px solid var(--border-emphasis)",
            "border-radius": "8px",
            "box-shadow": "var(--shadow-panel, 0 8px 24px rgba(0,0,0,0.5))",
            overflow: "hidden",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ position: "relative" }}>
            <input
              type="text"
              placeholder={mode() === "commands" ? "Type a command..." : "Search files by name…"}
              value={query()}
              autofocus
              onInput={(e) => {
                setQuery(e.currentTarget.value)
                setActiveIndex(0)
              }}
              style={{
                width: "100%",
                padding: "12px 14px",
                "padding-right": "80px",
                background: "transparent",
                border: "none",
                "border-bottom": "1px solid var(--border-default)",
                color: "var(--text-primary)",
                "font-size": "14px",
                outline: "none",
              }}
            />
            <span
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                "font-size": "10px",
                color: "var(--text-tertiary)",
                background: "var(--bg-3)",
                padding: "2px 6px",
                "border-radius": "3px",
                "font-family": "var(--font-mono)",
              }}
            >
              {modeLabel()}
            </span>
          </div>

          <Show when={mode() === "files" && !query().trim()}>
            <div
              style={{
                padding: "16px",
                color: "var(--text-tertiary)",
                "text-align": "center",
                "font-size": "12px",
              }}
            >
              Type to search files — prefix with{" "}
              <code
                style={{
                  color: "var(--text-secondary)",
                  background: "var(--bg-3)",
                  padding: "1px 4px",
                  "border-radius": "2px",
                }}
              >
                &gt;
              </code>{" "}
              for commands
            </div>
          </Show>

          <div style={{ "max-height": "400px", "overflow-y": "auto" }}>
            <Show when={mode() === "commands"}>
              <For
                each={rankedCommands()}
                fallback={
                  <div
                    style={{
                      padding: "16px",
                      color: "var(--text-tertiary)",
                      "text-align": "center",
                    }}
                  >
                    No matching commands
                  </div>
                }
              >
                {(r, i) => (
                  <button
                    type="button"
                    onClick={() => {
                      r.item.run()
                      props.onClose()
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      "text-align": "left",
                      background: i() === activeIndex() ? "var(--bg-3)" : "transparent",
                      "border-left":
                        i() === activeIndex()
                          ? "2px solid var(--accent-500)"
                          : "2px solid transparent",
                      color: "var(--text-primary)",
                      "font-size": "13px",
                      display: "flex",
                      "align-items": "center",
                      "justify-content": "space-between",
                      cursor: "pointer",
                    }}
                  >
                    <span>{r.item.label}</span>
                    <Show when={r.item.hint}>
                      <span style={{ color: "var(--text-tertiary)", "font-size": "11px" }}>
                        {r.item.hint}
                      </span>
                    </Show>
                  </button>
                )}
              </For>
            </Show>

            <Show when={mode() === "files" && query().trim()}>
              <For
                each={rankedFiles()}
                fallback={
                  <div
                    style={{
                      padding: "16px",
                      color: "var(--text-tertiary)",
                      "text-align": "center",
                    }}
                  >
                    No matching files
                  </div>
                }
              >
                {(r, i) => {
                  const Icon = fileIcon(r.item.path)
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        props.onOpenFile?.(r.item.path)
                        props.onClose()
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 14px",
                        "text-align": "left",
                        background: i() === activeIndex() ? "var(--bg-3)" : "transparent",
                        "border-left":
                          i() === activeIndex()
                            ? "2px solid var(--accent-500)"
                            : "2px solid transparent",
                        color: "var(--text-primary)",
                        "font-size": "13px",
                        display: "flex",
                        "align-items": "center",
                        gap: "10px",
                        cursor: "pointer",
                      }}
                    >
                      <Icon
                        size={14}
                        style={{ color: "var(--text-tertiary)", "flex-shrink": "0" }}
                      />
                      <span style={{ flex: "1 1 auto", "min-width": 0 }}>
                        <span>{basename(r.item.path)}</span>
                        <Show when={dirname(r.item.path)}>
                          <span
                            style={{
                              color: "var(--text-tertiary)",
                              "font-size": "11px",
                              "margin-left": "8px",
                            }}
                          >
                            {dirname(r.item.path)}
                          </span>
                        </Show>
                      </span>
                    </button>
                  )
                }}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  )
}
