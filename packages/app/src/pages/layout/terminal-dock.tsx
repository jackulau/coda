import { effectiveCursorBlink } from "@coda/core/terminal-settings/settings"
import { listen } from "@tauri-apps/api/event"
import { FitAddon } from "@xterm/addon-fit"
import { Terminal } from "@xterm/xterm"
import xtermCss from "@xterm/xterm/css/xterm.css?inline"
import { TerminalSquare, X } from "lucide-solid"
import { type Component, createEffect, onCleanup, onMount } from "solid-js"
import { ResizeHandle } from "../../components/resize-handle"
import { terminalThemeFor } from "../../components/terminal/terminal-theme"
import { useLayout } from "../../context/layout"
import { useWorkspaces } from "../../context/workspace"
import { ptyKill, ptyResize, ptySpawn, ptyWrite } from "../../lib/ipc"
import { useSettings } from "../settings/settings-store"

/**
 * Terminal dock — a bottom-docked panel toggled via the status-bar button or
 * ⌘` / ⌘J. Spawns a real pty rooted at the selected workspace's cwd, streams
 * bytes through an xterm.js canvas, and keeps a single session alive for the
 * lifetime of the mount.
 *
 * Dismiss paths: the × button in the header, pressing Escape in the container,
 * ⌘\`, ⌘J, or the status-bar toggle.
 */
export const TerminalDock: Component<{ onClose: () => void }> = (props) => {
  const layout = useLayout()
  const settings = useSettings()
  const ws = useWorkspaces()
  let rootRef: HTMLElement | undefined
  let mountRef: HTMLDivElement | undefined
  let term: Terminal | null = null
  let fit: FitAddon | null = null
  let sessionId: string | null = null
  let unlistenData: (() => void) | null = null
  let unlistenExit: (() => void) | null = null
  let resizeObs: ResizeObserver | null = null

  const injectCss = () => {
    if (typeof document === "undefined") return
    if (document.getElementById("coda-xterm-css")) return
    const s = document.createElement("style")
    s.id = "coda-xterm-css"
    s.textContent = xtermCss
    document.head.appendChild(s)
  }

  const startPty = async () => {
    const sel = ws.workspaces().find((w) => w.id === ws.selectedId())
    const cwd = sel?.cwd ?? (typeof process !== "undefined" ? (process.cwd?.() ?? ".") : ".")
    if (!term || !fit) return
    fit.fit()
    const { rows, cols } = term
    try {
      sessionId = await ptySpawn({ cwd, rows, cols })
    } catch (err) {
      term.write(`\r\n[coda] failed to spawn pty: ${String(err)}\r\n`)
      return
    }

    unlistenData = await listen<{ data: string }>(`pty://${sessionId}/data`, (e) => {
      if (!term) return
      const decoded = atobBytes(e.payload.data)
      term.write(decoded)
    })
    unlistenExit = await listen<{ code: number | null }>(`pty://${sessionId}/exit`, (e) => {
      if (!term) return
      term.write(`\r\n[coda] pty exited (code=${e.payload.code ?? "?"})\r\n`)
      sessionId = null
    })

    term.onData((data) => {
      if (!sessionId) return
      void ptyWrite(sessionId, data).catch(() => {})
    })
    term.onResize(({ rows, cols }) => {
      if (!sessionId) return
      void ptyResize(sessionId, rows, cols).catch(() => {})
    })
  }

  onMount(() => {
    injectCss()
    if (!mountRef) return
    term = new Terminal({
      convertEol: true,
      cursorBlink: effectiveCursorBlink(settings().terminalCursorBlink, settings().reducedMotion),
      cursorStyle: settings().terminalCursorStyle,
      scrollback: settings().terminalScrollback,
      fontFamily: "var(--font-mono), Menlo, Monaco, monospace",
      fontSize: 12,
      theme: {
        ...terminalThemeFor(settings().theme),
        cursor: "#e6e6e6",
      },
    })
    fit = new FitAddon()
    term.loadAddon(fit)
    term.open(mountRef)
    fit.fit()

    // Re-fit on container resize — the ResizeHandle doesn't fire a DOM resize
    // event, but ResizeObserver catches the CSS height change either way.
    resizeObs = new ResizeObserver(() => {
      try {
        fit?.fit()
      } catch {
        // terminal may have been disposed during unmount; ignore.
      }
    })
    resizeObs.observe(mountRef)

    void startPty()

    createEffect(() => {
      if (!term) return
      const palette = terminalThemeFor(settings().theme)
      term.options.theme = { ...term.options.theme, ...palette }
      term.options.cursorStyle = settings().terminalCursorStyle
      term.options.cursorBlink = effectiveCursorBlink(
        settings().terminalCursorBlink,
        settings().reducedMotion,
      )
      term.options.scrollback = settings().terminalScrollback
    })

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

  onCleanup(() => {
    resizeObs?.disconnect()
    unlistenData?.()
    unlistenExit?.()
    if (sessionId) void ptyKill(sessionId).catch(() => {})
    term?.dispose()
    term = null
    fit = null
  })

  return (
    <section
      ref={(el) => {
        rootRef = el
      }}
      data-testid="terminal-dock"
      style={{
        height: `${layout.state().terminalHeight}px`,
        "min-height": "120px",
        "max-height": "80vh",
        "flex-shrink": 0,
        "border-top": "1px solid var(--border-subtle)",
        display: "flex",
        "flex-direction": "column",
        "background-color": "#0a0a0a",
        position: "relative",
      }}
    >
      <ResizeHandle
        direction="vertical"
        ariaLabel="Resize terminal"
        testId="terminal-resize-handle"
        onDrag={(d) => layout.setTerminalHeight(layout.state().terminalHeight - d)}
        onNudge={(d) => layout.setTerminalHeight(layout.state().terminalHeight - d)}
      />
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
        ref={(el) => {
          mountRef = el
        }}
        data-testid="terminal-output"
        style={{
          flex: "1 1 auto",
          overflow: "hidden",
          "background-color": "#0a0a0a",
          padding: "4px 8px",
        }}
      />
    </section>
  )
}

function atobBytes(b64: string): Uint8Array {
  if (typeof atob !== "function") return new Uint8Array()
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
