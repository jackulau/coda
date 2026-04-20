import { TerminalSquare, X } from "lucide-solid"
import { type Component, createSignal } from "solid-js"

/**
 * Terminal dock — a bottom-docked panel toggled via the status-bar button or
 * ⌘` / ⌘J. Today it renders a local echo buffer (commands are not yet piped
 * to a real pty). Wiring to Tauri's shell plugin is a follow-up; the UI
 * exists now so there's no mystery about where the terminal lives.
 */
export const TerminalDock: Component<{ onClose: () => void }> = (props) => {
  const [input, setInput] = createSignal("")
  const [lines, setLines] = createSignal<string[]>([
    "Coda terminal — not yet connected to a pty.",
    "Commands echoed locally until the shell bridge ships.",
    "",
  ])

  const submit = () => {
    const cmd = input().trim()
    if (!cmd) return
    setLines([...lines(), `$ ${cmd}`, "(local echo — pty wiring pending)"])
    setInput("")
  }

  return (
    <section
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
          height: "28px",
          padding: "0 10px",
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
          onClick={() => props.onClose()}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            display: "inline-flex",
            "align-items": "center",
            padding: "2px",
            "border-radius": "3px",
          }}
        >
          <X size={12} aria-hidden="true" />
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
