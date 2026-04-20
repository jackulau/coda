import { TerminalSquare, X } from "lucide-solid"
import { type Component, createSignal, onCleanup, onMount } from "solid-js"

/**
 * Terminal dock — a bottom-docked panel toggled via the status-bar button or
 * ⌘` / ⌘J. Today it renders a local echo buffer (commands are not yet piped
 * to a real pty). Wiring to Tauri's shell plugin is a follow-up; the UI
 * exists now so there's no mystery about where the terminal lives.
 *
 * Dismiss paths: the × button in the header, pressing Escape from the input,
 * ⌘\`, ⌘J, or the status-bar toggle.
 */
export const TerminalDock: Component<{ onClose: () => void }> = (props) => {
  const [input, setInput] = createSignal("")
  const [lines, setLines] = createSignal<string[]>([
    "Coda terminal — not yet connected to a pty.",
    "Commands echoed locally until the shell bridge ships.",
    "Press Esc or click × to close.",
    "",
  ])

  const submit = () => {
    const cmd = input().trim()
    if (!cmd) return
    setLines([...lines(), `$ ${cmd}`, "(local echo — pty wiring pending)"])
    setInput("")
  }

  // Esc anywhere inside the dock closes it. We scope to the dock by checking
  // e.target is inside the dock element — any outer Esc handler will still
  // run for inputs outside.
  let rootRef: HTMLElement | undefined
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (!rootRef) return
      if (rootRef.contains(e.target as Node)) {
        e.preventDefault()
        props.onClose()
      }
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  return (
    <section
      ref={(el) => {
        rootRef = el
      }}
      data-testid="terminal-dock"
      style={{
        height: "240px",
        "min-height": "180px",
        "max-height": "50vh",
        "flex-shrink": 0,
        "border-top": "1px solid var(--border-subtle)",
        display: "flex",
        "flex-direction": "column",
        "background-color": "var(--bg-0)",
      }}
    >
      <header
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          height: "32px",
          padding: "0 6px 0 10px",
          "background-color": "var(--bg-1)",
          "border-bottom": "1px solid var(--border-subtle)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            "align-items": "center",
            gap: "6px",
            color: "var(--text-secondary)",
            "font-size": "11px",
            "text-transform": "uppercase",
            "letter-spacing": "0.05em",
          }}
        >
          <TerminalSquare size={12} aria-hidden="true" />
          Terminal
        </span>
        <button
          type="button"
          data-testid="terminal-close"
          aria-label="Close terminal"
          title="Close terminal (Esc)"
          onClick={() => props.onClose()}
          style={{
            display: "inline-flex",
            "align-items": "center",
            gap: "6px",
            padding: "4px 8px",
            background: "transparent",
            border: "1px solid var(--border-default)",
            color: "var(--text-secondary)",
            "border-radius": "4px",
            "font-size": "11px",
            cursor: "pointer",
            transition:
              "background-color var(--motion-fast), color var(--motion-fast), border-color var(--motion-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--bg-2)"
            e.currentTarget.style.color = "var(--text-primary)"
            e.currentTarget.style.borderColor = "var(--border-emphasis)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent"
            e.currentTarget.style.color = "var(--text-secondary)"
            e.currentTarget.style.borderColor = "var(--border-default)"
          }}
        >
          <X size={12} aria-hidden="true" />
          <span>Close</span>
          <kbd
            style={{
              "font-family": "var(--font-mono)",
              "font-size": "10px",
              padding: "1px 4px",
              "border-radius": "3px",
              "background-color": "var(--bg-3)",
              color: "var(--text-tertiary)",
            }}
          >
            Esc
          </kbd>
        </button>
      </header>
      <div
        data-testid="terminal-output"
        style={{
          flex: "1 1 auto",
          overflow: "auto",
          padding: "8px 12px",
          "font-family": "var(--font-mono)",
          "font-size": "12px",
          "line-height": 1.55,
          color: "var(--text-secondary)",
          "white-space": "pre-wrap",
        }}
      >
        {lines().join("\n")}
      </div>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "6px",
          height: "28px",
          padding: "0 10px",
          "border-top": "1px solid var(--border-subtle)",
          "background-color": "var(--bg-0)",
          "font-family": "var(--font-mono)",
          "font-size": "12px",
        }}
      >
        <span style={{ color: "var(--accent-500)" }}>$</span>
        <input
          data-testid="terminal-input"
          type="text"
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submit()
            }
          }}
          style={{
            flex: "1 1 auto",
            background: "transparent",
            border: "none",
            color: "var(--text-primary)",
            outline: "none",
            "font-family": "var(--font-mono)",
            "font-size": "12px",
          }}
          placeholder="echo hello"
        />
      </div>
    </section>
  )
}
