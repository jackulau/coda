import { type Component, For, type JSX, Show } from "solid-js"
import { ToastContext, createToastCtx, useToasts } from "../context/toasts"

export const ToastProvider: Component<{ children: JSX.Element }> = (props) => {
  const ctx = createToastCtx()
  return (
    <ToastContext.Provider value={ctx}>
      {props.children}
      <ToastStack />
    </ToastContext.Provider>
  )
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

const ToastStack: Component = () => {
  const ctx = useToasts()
  const reduced = prefersReducedMotion()
  const color = (kind: string): string => {
    switch (kind) {
      case "error":
        return "var(--diff-remove)"
      case "warn":
        return "var(--status-await)"
      case "success":
        return "var(--accent-500)"
      default:
        return "var(--text-secondary)"
    }
  }
  return (
    <div
      data-testid="toast-stack"
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        display: "flex",
        "flex-direction": "column",
        gap: "8px",
        "pointer-events": "none",
        "z-index": 1000,
      }}
    >
      <For each={ctx.toasts()}>
        {(t) => (
          <div
            data-testid={`toast-${t.id}`}
            data-kind={t.kind}
            class={reduced ? "toast-static" : "toast-animated"}
            style={{
              padding: "8px 12px",
              "background-color": "var(--bg-1)",
              "border-left": `3px solid ${color(t.kind)}`,
              "border-radius": "4px",
              color: "var(--text-primary)",
              "font-size": "12px",
              "max-width": "380px",
              "pointer-events": "auto",
              display: "flex",
              gap: "8px",
              "align-items": "flex-start",
              transition: reduced ? "none" : "opacity var(--motion-fast, 120ms)",
            }}
          >
            <div style={{ flex: "1 1 auto" }}>
              <div>{t.message}</div>
              <Show when={t.detail}>
                {(d) => (
                  <div
                    style={{
                      "margin-top": "4px",
                      "font-size": "11px",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {d()}
                  </div>
                )}
              </Show>
            </div>
            <button
              type="button"
              data-testid={`toast-dismiss-${t.id}`}
              onClick={() => ctx.dismiss(t.id)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-tertiary)",
                cursor: "pointer",
                "font-size": "12px",
              }}
              aria-label={`Dismiss ${t.kind} notification: ${t.message}`}
            >
              ×
            </button>
          </div>
        )}
      </For>
    </div>
  )
}
