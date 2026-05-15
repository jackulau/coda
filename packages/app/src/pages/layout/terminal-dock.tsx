import { AgentQueue, type PendingMessage } from "@coda/core/agent-queue"
import { listen } from "@tauri-apps/api/event"
import { FitAddon } from "@xterm/addon-fit"
import { Terminal } from "@xterm/xterm"
import xtermCss from "@xterm/xterm/css/xterm.css?inline"
import { ChevronUp, Rows2, Send, X } from "lucide-solid"
import {
  type Component,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js"
import { AGENTS, type AgentKind, AgentLogo, agentMeta } from "../../components/agent-logos"
import { ResizeHandle } from "../../components/resize-handle"
import { useLayout } from "../../context/layout"
import { type TerminalTab, useTerminalTabs } from "../../context/terminal-tabs"
import { useWorkspaces } from "../../context/workspace"
import { ptyKill, ptyResize, ptySpawn, ptyWrite } from "../../lib/ipc"
import { useSettings } from "../settings/settings-store"

const IDLE_MS = 1500

/**
 * Terminal dock — multi-tab panel with per-agent quick-launch, plus an
 * optional canvas mode where terminals become free-floating windows on a
 * pannable grid. One real PTY per tab; panes stay mounted across tab
 * switches so scrollback is preserved.
 */
export const TerminalDock: Component<{ onClose: () => void }> = (props) => {
  const layout = useLayout()
  const tabs = useTerminalTabs()
  const settings = useSettings()
  let rootRef: HTMLElement | undefined

  injectCss()

  // Lazy mount — only allocate xterm + PTY for tabs the user has actually
  // visited. Once mounted, panes stay alive so scrollback + agent state
  // survive tab switches.
  const [mountedTabIds, setMountedTabIds] = createSignal<ReadonlySet<string>>(new Set())
  createEffect(() => {
    const id = tabs.activeId()
    if (!id) return
    setMountedTabIds((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
  })

  const enabledAgents = createMemo(() => {
    const vis = settings().agents
    return AGENTS.filter((a) => {
      if (a.kind === "shell") return true
      return vis[a.kind as keyof typeof vis] !== false
    })
  })

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

  const canvas = () => settings().canvasMode

  return (
    <section
      ref={(el) => {
        rootRef = el
      }}
      data-testid="terminal-dock"
      style={{
        height: `${layout.state().terminalHeight}px`,
        "min-height": "160px",
        "max-height": "80vh",
        "flex-shrink": 0,
        "border-top": "1px solid var(--border-subtle)",
        display: "flex",
        "flex-direction": "column",
        "background-color": "var(--bg-0)",
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
          gap: "4px",
          height: "30px",
          padding: "0 6px 0 4px",
          "background-color": "var(--bg-1)",
          "border-bottom": "1px solid var(--border-subtle)",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            "align-items": "stretch",
            flex: "1 1 auto",
            "overflow-x": "auto",
            "overflow-y": "hidden",
          }}
          data-testid="terminal-tabbar"
        >
          <For each={tabs.tabs()}>
            {(t) => (
              <div
                role="tab"
                aria-selected={tabs.activeId() === t.id}
                tabIndex={tabs.activeId() === t.id ? 0 : -1}
                class="coda-term-tab"
                data-testid={`terminal-tab-${t.id}`}
                data-active={tabs.activeId() === t.id ? "true" : "false"}
                onClick={() => tabs.activate(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    tabs.activate(t.id)
                  }
                }}
                title={agentMeta(t.kind).label}
              >
                <AgentLogo kind={t.kind} size={12} />
                <span>{t.title}</span>
                <button
                  type="button"
                  class="coda-term-close"
                  aria-label={`Close ${t.title}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    tabs.closeTab(t.id)
                  }}
                >
                  <X size={11} aria-hidden="true" />
                </button>
              </div>
            )}
          </For>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              gap: "1px",
              "padding-left": "4px",
              "margin-left": "2px",
              "border-left": "1px solid var(--border-subtle)",
            }}
            data-testid="terminal-agent-shortcuts"
          >
            <For each={enabledAgents()}>
              {(a) => (
                <button
                  type="button"
                  class="coda-agent-shortcut"
                  data-testid={`terminal-add-${a.kind}`}
                  title={`New ${a.label}`}
                  onClick={() => tabs.addTab(a.kind)}
                >
                  <span class={a.className} style={{ display: "inline-flex" }}>
                    <a.logo size={13} />
                  </span>
                </button>
              )}
            </For>
          </div>
        </div>
        <button
          type="button"
          data-testid="terminal-reset-layout"
          aria-label="Reset terminal layout"
          title="Reset canvas layout"
          onClick={() => tabs.resetLayout()}
          style={{
            display: canvas() ? "inline-flex" : "none",
            "align-items": "center",
            "justify-content": "center",
            width: "24px",
            height: "22px",
            border: "1px solid var(--border-default)",
            "border-radius": "4px",
            background: "transparent",
            color: "var(--text-secondary)",
          }}
        >
          <Rows2 size={12} aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid="terminal-close"
          aria-label="Close terminal"
          title="Close terminal (Esc)"
          onClick={(e) => {
            e.stopPropagation()
            props.onClose()
          }}
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
          }}
        >
          <X size={11} aria-hidden="true" />
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

      <Show
        when={canvas()}
        fallback={
          <div
            style={{
              flex: "1 1 auto",
              position: "relative",
              "background-color": "#0a0a0a",
            }}
            data-testid="terminal-dock-body"
          >
            <For each={tabs.tabs()}>
              {(tab) => (
                <Show when={mountedTabIds().has(tab.id)}>
                  <TerminalPane tab={tab} visible={tabs.activeId() === tab.id} mode="docked" />
                </Show>
              )}
            </For>
            <Show when={tabs.tabs().length === 0}>
              <EmptyPane />
            </Show>
          </div>
        }
      >
        <CanvasSurface />
      </Show>
    </section>
  )
}

const EmptyPane: Component = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      color: "var(--text-tertiary)",
      "font-size": "12px",
    }}
  >
    No terminals. Click + to open one.
  </div>
)

const CanvasSurface: Component = () => {
  const tabs = useTerminalTabs()
  let surfaceRef: HTMLDivElement | undefined
  const [spaceDown, setSpaceDown] = createSignal(false)
  const [panning, setPanning] = createSignal<null | {
    x: number
    y: number
    px: number
    py: number
  }>(null)

  onMount(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !spaceDown()) setSpaceDown(true)
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    onCleanup(() => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    })
  })

  const onPointerDown = (e: PointerEvent) => {
    if (!spaceDown()) return
    if (!(e.target instanceof HTMLElement) || !e.target.classList.contains("coda-term-canvas"))
      return
    e.preventDefault()
    surfaceRef?.setPointerCapture(e.pointerId)
    setPanning({ x: e.clientX, y: e.clientY, px: tabs.pan().x, py: tabs.pan().y })
  }
  const onPointerMove = (e: PointerEvent) => {
    const p = panning()
    if (!p) return
    tabs.setPan({ x: p.px + (e.clientX - p.x), y: p.py + (e.clientY - p.y) })
  }
  const onPointerUp = (e: PointerEvent) => {
    if (panning()) {
      surfaceRef?.releasePointerCapture(e.pointerId)
      setPanning(null)
    }
  }
  const onWheel = (e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    const factor = Math.exp(-e.deltaY * 0.001)
    tabs.setZoom(Math.max(0.5, Math.min(2, tabs.zoom() * factor)))
  }

  return (
    <div
      ref={(el) => {
        surfaceRef = el
      }}
      class="coda-term-canvas"
      data-testid="terminal-canvas"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      style={{
        cursor: spaceDown() ? (panning() ? "grabbing" : "grab") : "default",
        "background-position": `${tabs.pan().x}px ${tabs.pan().y}px`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${tabs.pan().x}px, ${tabs.pan().y}px) scale(${tabs.zoom()})`,
          "transform-origin": "0 0",
        }}
      >
        <For each={tabs.tabs()}>
          {(tab) => <FloatingTerminal tab={tab} active={tabs.activeId() === tab.id} />}
        </For>
      </div>
    </div>
  )
}

const FloatingTerminal: Component<{ tab: TerminalTab; active: boolean }> = (props) => {
  const tabs = useTerminalTabs()
  let winRef: HTMLDivElement | undefined
  const [dragging, setDragging] = createSignal<null | {
    x: number
    y: number
    tx: number
    ty: number
  }>(null)
  const [resizing, setResizing] = createSignal<null | {
    x: number
    y: number
    tw: number
    th: number
  }>(null)

  const beginDrag = (e: PointerEvent) => {
    if (e.button !== 0) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDragging({ x: e.clientX, y: e.clientY, tx: props.tab.x, ty: props.tab.y })
    tabs.activate(props.tab.id)
  }
  const onDrag = (e: PointerEvent) => {
    const d = dragging()
    if (!d) return
    tabs.updateTab(props.tab.id, {
      x: Math.max(0, d.tx + (e.clientX - d.x) / tabs.zoom()),
      y: Math.max(0, d.ty + (e.clientY - d.y) / tabs.zoom()),
    })
  }
  const endDrag = (e: PointerEvent) => {
    if (dragging()) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      setDragging(null)
    }
  }
  const beginResize = (e: PointerEvent) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setResizing({ x: e.clientX, y: e.clientY, tw: props.tab.w, th: props.tab.h })
  }
  const onResize = (e: PointerEvent) => {
    const r = resizing()
    if (!r) return
    tabs.updateTab(props.tab.id, {
      w: Math.max(240, r.tw + (e.clientX - r.x) / tabs.zoom()),
      h: Math.max(160, r.th + (e.clientY - r.y) / tabs.zoom()),
    })
  }
  const endResize = (e: PointerEvent) => {
    if (resizing()) {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
      setResizing(null)
    }
  }

  return (
    <div
      ref={(el) => {
        winRef = el
      }}
      class="coda-term-window"
      data-testid={`terminal-window-${props.tab.id}`}
      data-active={props.active ? "true" : "false"}
      style={{
        left: `${props.tab.x}px`,
        top: `${props.tab.y}px`,
        width: `${props.tab.w}px`,
        height: `${props.tab.h}px`,
      }}
      onPointerDown={() => tabs.activate(props.tab.id)}
    >
      <div
        class="coda-term-window-header"
        data-dragging={dragging() ? "true" : "false"}
        onPointerDown={beginDrag}
        onPointerMove={onDrag}
        onPointerUp={endDrag}
      >
        <AgentLogo kind={props.tab.kind} size={11} />
        <span style={{ flex: "1 1 auto" }}>{props.tab.title}</span>
        <button
          type="button"
          aria-label={`Close ${props.tab.title}`}
          onClick={(e) => {
            e.stopPropagation()
            tabs.closeTab(props.tab.id)
          }}
          style={{
            display: "inline-flex",
            "align-items": "center",
            "justify-content": "center",
            width: "18px",
            height: "18px",
            background: "transparent",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            "border-radius": "3px",
          }}
        >
          <X size={11} aria-hidden="true" />
        </button>
      </div>
      <div class="coda-term-window-body">
        <TerminalPane tab={props.tab} visible={true} mode="canvas" />
      </div>
      <span
        class="coda-term-resize-corner"
        aria-hidden="true"
        onPointerDown={beginResize}
        onPointerMove={onResize}
        onPointerUp={endResize}
      />
    </div>
  )
}

const TerminalPane: Component<{
  tab: TerminalTab
  visible: boolean
  mode: "docked" | "canvas"
}> = (props) => {
  const ws = useWorkspaces()
  const settings = useSettings()
  let mountRef: HTMLDivElement | undefined
  let term: Terminal | null = null
  let fit: FitAddon | null = null
  let sessionId: string | null = null
  let unlistenData: (() => void) | null = null
  let unlistenExit: (() => void) | null = null
  let resizeObs: ResizeObserver | null = null
  let prevVisible = true
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  const queue = new AgentQueue()
  const [pending, setPending] = createSignal<readonly PendingMessage[]>([])
  const [busy, setBusyState] = createSignal(false)
  const off = queue.subscribe(() => {
    setPending(queue.list())
    setBusyState(queue.busy())
  })
  onCleanup(off)

  const sendToPty = async (text: string) => {
    if (!sessionId) throw new Error("pty not ready")
    await ptyWrite(sessionId, `${text}\r`)
  }

  const tryDrain = () => {
    void queue.drain(sendToPty).catch(() => {})
  }

  const markBusy = () => {
    queue.setBusy(true)
    if (idleTimer !== null) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      idleTimer = null
      queue.setBusy(false)
      tryDrain()
    }, IDLE_MS)
  }

  const startPty = async () => {
    if (!term || !fit) return
    const sel = ws.workspaces().find((w) => w.id === ws.selectedId())
    const cwd = sel?.cwd ?? "."
    fit.fit()
    const { rows, cols } = term
    const meta = agentMeta(props.tab.kind)
    const shell = resolveShell(meta.command, settings().terminalShell)
    try {
      sessionId = await ptySpawn({ cwd, rows, cols, shell })
    } catch (err) {
      const msg = meta.command
        ? `\r\n[coda] failed to spawn \`${meta.command}\`: ${String(err)}\r\n` +
          `        Is \`${meta.command}\` on your PATH?\r\n`
        : `\r\n[coda] failed to spawn shell: ${String(err)}\r\n`
      term.write(msg)
      return
    }
    unlistenData = await listen<{ data: string }>(`pty://${sessionId}/data`, (e) => {
      if (!term) return
      term.write(atobBytes(e.payload.data))
      markBusy()
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
    if (!mountRef) return
    term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: "var(--font-mono), Menlo, Monaco, monospace",
      fontSize: settings().terminalFontSize,
      theme: {
        background: "#0a0a0a",
        foreground: "#e6e6e6",
        cursor: "#ff6b1a",
        cursorAccent: "#0a0a0a",
        selectionBackground: "rgba(255, 107, 26, 0.35)",
      },
    })
    fit = new FitAddon()
    term.loadAddon(fit)
    term.open(mountRef)
    fit.fit()

    resizeObs = new ResizeObserver(() => {
      try {
        fit?.fit()
      } catch {
        // Terminal may be disposed during unmount; ignore.
      }
    })
    resizeObs.observe(mountRef)

    void startPty()
  })

  onCleanup(() => {
    if (idleTimer !== null) clearTimeout(idleTimer)
    resizeObs?.disconnect()
    unlistenData?.()
    unlistenExit?.()
    if (sessionId) void ptyKill(sessionId).catch(() => {})
    term?.dispose()
    term = null
    fit = null
  })

  // When a tab is re-shown (display:none → block), xterm's internal
  // measurements may be stale. Queue a refit whenever visibility flips on.
  createEffect(() => {
    const nowVisible = props.visible
    if (!prevVisible && nowVisible) {
      queueMicrotask(() => {
        try {
          fit?.fit()
        } catch {
          // term disposed mid-flight; ignore.
        }
      })
    }
    prevVisible = nowVisible
  })

  const onEnqueue = (text: string) => {
    if (text.length === 0) return
    queue.enqueue(text)
    tryDrain()
  }

  return (
    <div
      data-testid={`terminal-pane-${props.tab.id}`}
      data-agent={props.tab.kind}
      style={{
        position: props.mode === "docked" ? "absolute" : "relative",
        inset: props.mode === "docked" ? "0" : undefined,
        height: props.mode === "docked" ? undefined : "100%",
        display: props.visible ? "flex" : "none",
        "flex-direction": "column",
        "background-color": "#0a0a0a",
        overflow: "hidden",
      }}
    >
      <div
        ref={(el) => {
          mountRef = el
        }}
        data-testid={`terminal-pane-xterm-${props.tab.id}`}
        style={{
          flex: "1 1 auto",
          "min-height": "0",
          padding: "4px 8px",
          overflow: "hidden",
        }}
      />
      <AgentComposer
        tabId={props.tab.id}
        agentKind={props.tab.kind}
        pending={pending()}
        busy={busy()}
        onEnqueue={onEnqueue}
        onCancel={(id) => queue.cancel(id)}
      />
    </div>
  )
}

const AgentComposer: Component<{
  tabId: string
  agentKind: AgentKind
  pending: readonly PendingMessage[]
  busy: boolean
  onEnqueue: (text: string) => void
  onCancel: (id: string) => void
}> = (props) => {
  const [draft, setDraft] = createSignal("")
  const [expanded, setExpanded] = createSignal(false)
  let inputRef: HTMLTextAreaElement | undefined

  const submit = () => {
    const text = draft().replace(/\s+$/, "")
    if (text.length === 0) return
    props.onEnqueue(text)
    setDraft("")
    if (inputRef) inputRef.style.height = "auto"
  }

  const autosize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`
  }

  return (
    <div
      data-testid={`agent-composer-${props.tabId}`}
      data-busy={props.busy ? "true" : "false"}
      style={{
        display: "flex",
        "flex-direction": "column",
        "border-top": "1px solid var(--border-subtle)",
        "background-color": "var(--bg-1)",
      }}
    >
      <Show when={expanded() && props.pending.length > 0}>
        <ul
          data-testid={`agent-queue-list-${props.tabId}`}
          style={{
            "list-style": "none",
            margin: "0",
            padding: "6px 8px",
            "max-height": "120px",
            overflow: "auto",
            "border-bottom": "1px solid var(--border-subtle)",
            "font-family": "var(--font-mono)",
            "font-size": "11px",
            color: "var(--text-secondary)",
          }}
        >
          <For each={props.pending}>
            {(m, i) => (
              <li
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "3px 0",
                }}
              >
                <span
                  style={{
                    color: "var(--text-tertiary)",
                    "min-width": "16px",
                  }}
                >
                  {i() + 1}.
                </span>
                <span
                  style={{
                    flex: "1 1 auto",
                    "min-width": "0",
                    overflow: "hidden",
                    "text-overflow": "ellipsis",
                    "white-space": "nowrap",
                  }}
                  title={m.text}
                >
                  {m.text}
                </span>
                <button
                  type="button"
                  aria-label={`Cancel queued message ${i() + 1}`}
                  data-testid={`agent-queue-cancel-${m.id}`}
                  onClick={() => props.onCancel(m.id)}
                  style={{
                    display: "inline-flex",
                    "align-items": "center",
                    "justify-content": "center",
                    width: "18px",
                    height: "18px",
                    background: "transparent",
                    border: "none",
                    color: "var(--text-tertiary)",
                    "border-radius": "3px",
                    cursor: "pointer",
                  }}
                >
                  <X size={11} aria-hidden="true" />
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <div
        style={{
          display: "flex",
          "align-items": "flex-end",
          gap: "6px",
          padding: "6px 8px",
        }}
      >
        <textarea
          ref={(el) => {
            inputRef = el
          }}
          data-testid={`agent-composer-input-${props.tabId}`}
          rows={1}
          placeholder={
            props.busy
              ? `Queueing for ${agentMeta(props.agentKind).label}…`
              : `Message ${agentMeta(props.agentKind).label} (Enter to send, Shift+Enter for newline)`
          }
          value={draft()}
          onInput={(e) => {
            setDraft(e.currentTarget.value)
            autosize(e.currentTarget)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          style={{
            flex: "1 1 auto",
            "min-width": "0",
            resize: "none",
            "max-height": "120px",
            padding: "6px 8px",
            "background-color": "var(--bg-input)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            "border-radius": "4px",
            "font-family": "var(--font-mono)",
            "font-size": "12px",
            "line-height": "1.4",
            outline: "none",
          }}
        />
        <button
          type="button"
          data-testid={`agent-composer-send-${props.tabId}`}
          aria-label="Send / queue message"
          title={props.busy ? "Agent busy — message will queue" : "Send"}
          onClick={submit}
          disabled={draft().trim().length === 0}
          style={{
            display: "inline-flex",
            "align-items": "center",
            "justify-content": "center",
            width: "28px",
            height: "28px",
            background: draft().trim().length === 0 ? "transparent" : "var(--accent-500)",
            color: draft().trim().length === 0 ? "var(--text-tertiary)" : "#0a0a0a",
            border:
              draft().trim().length === 0
                ? "1px solid var(--border-default)"
                : "1px solid transparent",
            "border-radius": "4px",
            cursor: draft().trim().length === 0 ? "default" : "pointer",
            transition: "background-color var(--motion-fast), color var(--motion-fast)",
          }}
        >
          <Send size={13} aria-hidden="true" />
        </button>
        <Show when={props.pending.length > 0}>
          <button
            type="button"
            data-testid={`agent-queue-toggle-${props.tabId}`}
            aria-label={`${props.pending.length} queued — ${expanded() ? "hide" : "show"} list`}
            onClick={() => setExpanded((v) => !v)}
            style={{
              display: "inline-flex",
              "align-items": "center",
              gap: "4px",
              height: "28px",
              padding: "0 8px",
              background: "var(--bg-2)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              "border-radius": "4px",
              "font-size": "11px",
              "font-variant-numeric": "tabular-nums",
              cursor: "pointer",
            }}
          >
            <span>{props.pending.length} queued</span>
            <ChevronUp
              size={11}
              aria-hidden="true"
              style={{
                transform: expanded() ? "rotate(0deg)" : "rotate(180deg)",
                transition: "transform var(--motion-fast)",
              }}
            />
          </button>
        </Show>
      </div>
    </div>
  )
}

function resolveShell(command: string, fallback: string): string | undefined {
  if (command && command.length > 0) return command
  if (fallback && fallback.length > 0) return fallback
  return undefined
}

function injectCss() {
  if (typeof document === "undefined") return
  if (document.getElementById("coda-xterm-css")) return
  const s = document.createElement("style")
  s.id = "coda-xterm-css"
  s.textContent = xtermCss
  document.head.appendChild(s)
}

function atobBytes(b64: string): Uint8Array {
  if (typeof atob !== "function") return new Uint8Array()
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export type { AgentKind }
