import { FolderOpen, Keyboard, Sparkles, Terminal } from "lucide-solid"
import { type Component, For } from "solid-js"

interface Props {
  onAddProject?: () => void
  onSkip?: () => void
}

const SHORTCUTS: Array<{ combo: string; label: string }> = [
  { combo: "⌘P", label: "Command palette" },
  { combo: "⌘O", label: "Open folder" },
  { combo: "⌘B", label: "Toggle sidebar" },
  { combo: "⌘`", label: "Toggle terminal" },
  { combo: "⌘,", label: "Settings" },
]

export const WelcomePage: Component<Props> = (props) => {
  return (
    <div
      data-testid="welcome-page"
      style={{
        flex: "1 1 auto",
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        "justify-content": "center",
        gap: "36px",
        padding: "48px 24px",
        "min-height": 0,
        overflow: "auto",
      }}
    >
      {/* Logo + title */}
      <div style={{ "text-align": "center" }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            margin: "0 auto 20px",
            "border-radius": "16px",
            "background-color": "var(--accent-500)",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            "box-shadow": "0 4px 24px rgba(255, 107, 26, 0.25)",
          }}
        >
          <Sparkles size={32} color="#fff" />
        </div>
        <h1
          style={{
            margin: "0 0 6px",
            "font-size": "24px",
            "font-weight": "600",
            color: "var(--text-primary)",
          }}
        >
          Welcome to Codaa
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--text-tertiary)",
            "font-size": "13px",
            "line-height": "1.5",
            "max-width": "360px",
          }}
        >
          Multi-agent coding environment. Open a project folder to get started.
        </p>
      </div>

      {/* CTA */}
      <div style={{ display: "flex", "flex-direction": "column", gap: "10px", width: "280px" }}>
        <button
          type="button"
          data-testid="welcome-add-project"
          onClick={() => props.onAddProject?.()}
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            gap: "10px",
            padding: "12px 20px",
            "background-color": "var(--accent-500)",
            color: "#fff",
            border: "none",
            "border-radius": "8px",
            "font-size": "14px",
            "font-weight": "600",
            cursor: "pointer",
            transition: "background-color var(--motion-fast), box-shadow var(--motion-fast)",
            "box-shadow": "0 2px 8px rgba(255, 107, 26, 0.2)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent-600, #e05a10)"
            e.currentTarget.style.boxShadow = "0 4px 16px rgba(255, 107, 26, 0.3)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent-500)"
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(255, 107, 26, 0.2)"
          }}
        >
          <FolderOpen size={16} />
          Open Folder
        </button>
        <button
          type="button"
          data-testid="welcome-skip"
          onClick={() => props.onSkip?.()}
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            gap: "8px",
            padding: "10px 20px",
            "background-color": "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-default)",
            "border-radius": "8px",
            "font-size": "13px",
            cursor: "pointer",
            transition: "background-color var(--motion-fast), color var(--motion-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--bg-2)"
            e.currentTarget.style.color = "var(--text-primary)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent"
            e.currentTarget.style.color = "var(--text-secondary)"
          }}
        >
          <Terminal size={14} />
          Skip to Editor
        </button>
      </div>

      {/* Keyboard shortcuts */}
      <div
        style={{
          width: "280px",
          "border-top": "1px solid var(--border-subtle)",
          "padding-top": "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            "align-items": "center",
            gap: "6px",
            color: "var(--text-tertiary)",
            "font-size": "11px",
            "font-weight": "600",
            "text-transform": "uppercase",
            "letter-spacing": "0.05em",
            "margin-bottom": "12px",
          }}
        >
          <Keyboard size={12} />
          Quick Reference
        </div>
        <For each={SHORTCUTS}>
          {(sc) => (
            <div
              style={{
                display: "flex",
                "justify-content": "space-between",
                "align-items": "center",
                padding: "5px 0",
                color: "var(--text-secondary)",
                "font-size": "12px",
              }}
            >
              <span>{sc.label}</span>
              <kbd
                style={{
                  "background-color": "var(--bg-2)",
                  border: "1px solid var(--border-default)",
                  "border-radius": "4px",
                  padding: "1px 6px",
                  "font-size": "11px",
                  "font-family": "var(--font-mono)",
                  color: "var(--text-primary)",
                }}
              >
                {sc.combo}
              </kbd>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
