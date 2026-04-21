import { codaBus } from "@coda/core"
import { type Component, For, Show, createSignal, onCleanup, onMount } from "solid-js"

interface Banner {
  id: string
  reason: string
  attempt: number
  at: number
}

export const CrashBanner: Component = () => {
  const [banners, setBanners] = createSignal<Banner[]>([])

  onMount(() => {
    const off = codaBus.on("Sidecar.Crashed", (e) => {
      setBanners((prev) => [
        ...prev.slice(-4),
        {
          id: crypto.randomUUID(),
          reason: e.reason,
          attempt: e.restartAttempt,
          at: Date.now(),
        },
      ])
      const id = setTimeout(() => {
        setBanners((prev) => prev.slice(1))
      }, 8000)
      onCleanup(() => clearTimeout(id))
    })
    onCleanup(off)
  })

  return (
    <Show when={banners().length > 0}>
      <div
        style={{
          position: "fixed",
          top: "44px",
          right: "12px",
          display: "flex",
          "flex-direction": "column",
          gap: "6px",
          // Higher than the command palette (z-1000) and toast stack
          // (z-1000) so a sidecar crash stays visible when the user is
          // mid-palette or has toasts stacked.
          "z-index": 1500,
        }}
      >
        <For each={banners()}>
          {(b) => (
            <div
              data-testid={b.attempt === -1 ? "crash-circuit-open" : "crash-restarting"}
              style={{
                padding: "8px 12px",
                background: b.attempt === -1 ? "var(--diff-remove)" : "var(--bg-3)",
                color: b.attempt === -1 ? "var(--bg-0)" : "var(--text-primary)",
                "border-radius": "6px",
                "box-shadow": "0 4px 12px rgba(0,0,0,0.4)",
                "font-size": "12px",
                "max-width": "360px",
              }}
            >
              <Show
                when={b.attempt === -1}
                fallback={
                  <span>
                    Sidecar restarting ({b.attempt}):{" "}
                    <span style={{ opacity: 0.8 }}>{b.reason}</span>
                  </span>
                }
              >
                <strong>Circuit open — too many crashes.</strong>
                <span style={{ display: "block", "margin-top": "2px", "font-size": "11px" }}>
                  {b.reason}
                </span>
              </Show>
            </div>
          )}
        </For>
      </div>
    </Show>
  )
}
