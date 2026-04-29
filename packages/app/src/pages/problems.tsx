import type { Diagnostic } from "@coda/core/problems/panel"
import { AlertCircle, CheckCircle, Info } from "lucide-solid"
import { type Component, For, Show } from "solid-js"

interface Props {
  diagnostics: Diagnostic[]
  onJump?: (d: Diagnostic) => void
}

const SEVERITY_STYLE: Record<string, { color: string; Icon: typeof AlertCircle }> = {
  error: { color: "var(--diff-remove)", Icon: AlertCircle },
  warning: { color: "var(--status-await)", Icon: AlertCircle },
  info: { color: "var(--accent-500)", Icon: Info },
}

export const ProblemsPanel: Component<Props> = (props) => {
  return (
    <div
      data-testid="problems-panel"
      style={{
        display: "flex",
        "flex-direction": "column",
        "min-height": 0,
        height: "100%",
      }}
    >
      <header
        style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          padding: "14px 20px",
          "border-bottom": "1px solid var(--border-subtle)",
          "font-size": "13px",
          "font-weight": "500",
          color: "var(--text-primary)",
        }}
      >
        Problems
        <Show when={props.diagnostics.length > 0}>
          <span
            style={{
              "background-color": "var(--bg-3)",
              "border-radius": "10px",
              padding: "1px 8px",
              "font-size": "11px",
              "font-family": "var(--font-mono)",
              color: "var(--text-tertiary)",
            }}
          >
            {props.diagnostics.length}
          </span>
        </Show>
      </header>

      <Show
        when={props.diagnostics.length > 0}
        fallback={
          <div
            data-testid="problems-empty"
            style={{
              flex: "1 1 auto",
              display: "flex",
              "flex-direction": "column",
              "align-items": "center",
              "justify-content": "center",
              gap: "10px",
              color: "var(--text-tertiary)",
              "font-size": "12px",
              padding: "24px",
            }}
          >
            <CheckCircle size={20} style={{ opacity: "0.4" }} />
            <div>No problems detected</div>
            <div style={{ "font-size": "11px", opacity: "0.6" }}>
              Diagnostics from language servers will appear here
            </div>
          </div>
        }
      >
        <div style={{ flex: "1 1 auto", overflow: "auto" }}>
          <For each={props.diagnostics}>
            {(d) => {
              const meta =
                SEVERITY_STYLE[d.severity] ??
                (SEVERITY_STYLE.info as { color: string; Icon: typeof AlertCircle })
              const Icon = meta.Icon
              return (
                <button
                  type="button"
                  class="coda-row-hover"
                  data-testid={`problem-${d.path}-${d.line}`}
                  onClick={() => props.onJump?.(d)}
                  style={{
                    width: "100%",
                    display: "flex",
                    "align-items": "flex-start",
                    gap: "8px",
                    padding: "6px 20px",
                    border: "none",
                    background: "transparent",
                    "text-align": "left",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                    "font-size": "12px",
                  }}
                >
                  <span style={{ "flex-shrink": "0", "margin-top": "2px", color: meta.color }}>
                    <Icon size={13} />
                  </span>
                  <span style={{ flex: "1 1 auto", "line-height": "1.4" }}>{d.message}</span>
                  <span
                    style={{
                      "flex-shrink": "0",
                      color: "var(--text-tertiary)",
                      "font-family": "var(--font-mono)",
                      "font-size": "11px",
                    }}
                  >
                    {d.path}:{d.line}
                  </span>
                </button>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}
