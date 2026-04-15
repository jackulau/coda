import { Palette } from "@coda/core"
import { type Component, For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js"

export interface PaletteCommand {
  id: string
  label: string
  hint?: string
  run: () => void
}

interface Props {
  commands: PaletteCommand[]
  open: () => boolean
  onClose: () => void
}

export const CommandPalette: Component<Props> = (props) => {
  const [query, setQuery] = createSignal("")
  const [activeIndex, setActiveIndex] = createSignal(0)

  const ranked = createMemo(() =>
    Palette.rank(props.commands, query(), (c) => `${c.label} ${c.id}`).slice(0, 50),
  )

  const onKeyDown = (e: KeyboardEvent) => {
    if (!props.open()) return
    if (e.key === "Escape") {
      e.preventDefault()
      props.onClose()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, ranked().length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const r = ranked()[activeIndex()]
      if (r) {
        r.item.run()
        props.onClose()
      }
    }
  }

  onMount(() => {
    window.addEventListener("keydown", onKeyDown)
  })
  onCleanup(() => {
    window.removeEventListener("keydown", onKeyDown)
  })

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
          <input
            type="text"
            placeholder="Type a command..."
            value={query()}
            autofocus
            onInput={(e) => {
              setQuery(e.currentTarget.value)
              setActiveIndex(0)
            }}
            style={{
              width: "100%",
              padding: "12px 14px",
              background: "transparent",
              border: "none",
              "border-bottom": "1px solid var(--border-default)",
              color: "var(--text-primary)",
              "font-size": "14px",
              outline: "none",
            }}
          />
          <div style={{ "max-height": "400px", "overflow-y": "auto" }}>
            <For
              each={ranked()}
              fallback={
                <div
                  style={{ padding: "16px", color: "var(--text-tertiary)", "text-align": "center" }}
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
          </div>
        </div>
      </div>
    </Show>
  )
}
