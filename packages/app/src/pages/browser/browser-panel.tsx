import {
  ArrowLeft,
  ArrowRight,
  Code,
  Eye,
  Globe,
  Inspect,
  Maximize2,
  Monitor,
  MousePointer2,
  Network,
  RefreshCw,
  Terminal,
  X,
} from "lucide-solid"
import { type Component, For, Show, createSignal, onCleanup, onMount } from "solid-js"
import { useSettings } from "../settings/settings-store"

type DevTab = "console" | "network" | "elements"

export const BrowserPanel: Component = () => {
  const settings = useSettings()
  const [url, setUrl] = createSignal(settings().browser.defaultUrl || "about:blank")
  const [urlInput, setUrlInput] = createSignal(url())
  const [loading, setLoading] = createSignal(false)
  const [designMode, setDesignMode] = createSignal(false)
  const [devToolsOpen, setDevToolsOpen] = createSignal(false)
  const [activeDevTab, setActiveDevTab] = createSignal<DevTab>("console")
  const [consoleLogs, setConsoleLogs] = createSignal<ConsoleEntry[]>([])
  const [networkRequests, setNetworkRequests] = createSignal<NetworkEntry[]>([])
  const [hoveredElement, setHoveredElement] = createSignal<ElementInfo | null>(null)
  const [history, setHistory] = createSignal<string[]>([url()])
  const [historyIdx, setHistoryIdx] = createSignal(0)

  let iframeRef: HTMLIFrameElement | undefined

  onMount(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || e.data.source !== "codaa-devtools") return
      if (e.data.type === "console") {
        setConsoleLogs((prev) => [
          ...prev,
          { level: e.data.level ?? "log", message: String(e.data.message), timestamp: Date.now() },
        ])
      } else if (e.data.type === "network") {
        setNetworkRequests((prev) => [
          ...prev,
          {
            method: e.data.method ?? "GET",
            url: String(e.data.url),
            status: e.data.status ?? 0,
            time: e.data.time ?? 0,
            timestamp: Date.now(),
          },
        ])
      }
    }
    window.addEventListener("message", handler)
    onCleanup(() => window.removeEventListener("message", handler))
  })

  const injectDevtoolsBridge = () => {
    if (!iframeRef) return
    try {
      const doc = iframeRef.contentDocument
      if (!doc) return
      const script = doc.createElement("script")
      script.textContent = `
        (function(){
          var levels = ["log","warn","error","info"];
          levels.forEach(function(lvl){
            var orig = console[lvl];
            console[lvl] = function(){
              var args = Array.prototype.slice.call(arguments);
              try { parent.postMessage({source:"codaa-devtools",type:"console",level:lvl,message:args.map(String).join(" ")},"*"); } catch(e){}
              return orig.apply(console, arguments);
            };
          });
          var origFetch = window.fetch;
          window.fetch = function(){
            var url = arguments[0]; var opts = arguments[1] || {};
            var method = (opts.method || "GET").toUpperCase();
            var t0 = performance.now();
            return origFetch.apply(this, arguments).then(function(resp){
              try { parent.postMessage({source:"codaa-devtools",type:"network",method:method,url:String(typeof url==="string"?url:url.url),status:resp.status,time:Math.round(performance.now()-t0)},"*"); } catch(e){}
              return resp;
            });
          };
        })();
      `
      doc.head.appendChild(script)
    } catch {
      // cross-origin — bridge not available
    }
  }

  const navigate = (newUrl: string) => {
    let resolved = newUrl
    if (resolved && !resolved.includes("://") && !resolved.startsWith("about:")) {
      resolved = `https://${resolved}`
    }
    setUrl(resolved)
    setUrlInput(resolved)
    setLoading(true)

    const h = history()
    const idx = historyIdx()
    const next = [...h.slice(0, idx + 1), resolved]
    setHistory(next)
    setHistoryIdx(next.length - 1)
  }

  const goBack = () => {
    const idx = historyIdx()
    if (idx <= 0) return
    const newIdx = idx - 1
    setHistoryIdx(newIdx)
    const target = history()[newIdx] ?? "about:blank"
    setUrl(target)
    setUrlInput(target)
  }

  const goForward = () => {
    const idx = historyIdx()
    const h = history()
    if (idx >= h.length - 1) return
    const newIdx = idx + 1
    setHistoryIdx(newIdx)
    const target = h[newIdx] ?? "about:blank"
    setUrl(target)
    setUrlInput(target)
  }

  const refresh = () => {
    setLoading(true)
    if (iframeRef) {
      iframeRef.src = url()
    }
  }

  const handleUrlSubmit = (e: Event) => {
    e.preventDefault()
    navigate(urlInput())
  }

  const handleIframeLoad = () => {
    setLoading(false)
    injectDevtoolsBridge()
  }

  const clearConsole = () => setConsoleLogs([])
  const clearNetwork = () => setNetworkRequests([])

  const canGoBack = () => historyIdx() > 0
  const canGoForward = () => historyIdx() < history().length - 1

  return (
    <div
      data-testid="browser-panel"
      style={{
        flex: "1 1 auto",
        display: "flex",
        "flex-direction": "column",
        "min-width": 0,
        "min-height": 0,
        "background-color": "var(--bg-0)",
      }}
    >
      {/* ── Toolbar ── */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "4px",
          padding: "6px 12px",
          "border-bottom": "1px solid var(--border-subtle)",
          "background-color": "var(--bg-1)",
          "flex-shrink": "0",
        }}
      >
        <NavButton onClick={goBack} disabled={!canGoBack()} title="Back">
          <ArrowLeft size={14} />
        </NavButton>
        <NavButton onClick={goForward} disabled={!canGoForward()} title="Forward">
          <ArrowRight size={14} />
        </NavButton>
        <NavButton onClick={refresh} title="Refresh">
          <RefreshCw size={14} class={loading() ? "spin" : ""} />
        </NavButton>

        {/* URL bar */}
        <form
          onSubmit={handleUrlSubmit}
          style={{
            flex: "1 1 auto",
            display: "flex",
            margin: "0 4px",
          }}
        >
          <div
            style={{
              flex: "1 1 auto",
              display: "flex",
              "align-items": "center",
              "background-color": "var(--bg-input)",
              border: "1px solid var(--border-default)",
              "border-radius": "6px",
              padding: "0 10px",
              gap: "6px",
            }}
          >
            <Globe size={12} style={{ color: "var(--text-tertiary)", "flex-shrink": "0" }} />
            <input
              type="text"
              data-testid="browser-url-input"
              value={urlInput()}
              onInput={(e) => setUrlInput(e.currentTarget.value)}
              placeholder="Enter URL or search..."
              style={{
                flex: "1 1 auto",
                border: "none",
                background: "transparent",
                color: "var(--text-primary)",
                "font-size": "12px",
                "font-family": "var(--font-mono)",
                padding: "5px 0",
                outline: "none",
              }}
            />
          </div>
        </form>

        {/* Design mode toggle */}
        <ToolbarButton
          active={designMode()}
          onClick={() => setDesignMode(!designMode())}
          title="Design Mode — Inspect and edit elements"
        >
          <MousePointer2 size={14} />
        </ToolbarButton>

        {/* DevTools toggle */}
        <ToolbarButton
          active={devToolsOpen()}
          onClick={() => setDevToolsOpen(!devToolsOpen())}
          title="Toggle Developer Tools"
        >
          <Code size={14} />
        </ToolbarButton>
      </div>

      {/* ── Content Area ── */}
      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          "flex-direction": "column",
          "min-height": 0,
          position: "relative",
        }}
      >
        {/* Browser viewport */}
        <div
          style={{
            flex: "1 1 auto",
            position: "relative",
            "min-height": 0,
          }}
        >
          <Show
            when={url() && url() !== "about:blank"}
            fallback={
              <div
                style={{
                  display: "flex",
                  "flex-direction": "column",
                  "align-items": "center",
                  "justify-content": "center",
                  height: "100%",
                  gap: "16px",
                  color: "var(--text-tertiary)",
                }}
              >
                <Globe size={48} style={{ opacity: "0.3" }} />
                <div style={{ "font-size": "14px" }}>Enter a URL to get started</div>
                <div style={{ "font-size": "12px", opacity: "0.6" }}>
                  Try http://localhost:3000 or any website
                </div>
              </div>
            }
          >
            <iframe
              ref={iframeRef}
              src={url()}
              title="Browser viewport"
              onLoad={handleIframeLoad}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                "background-color": "#fff",
              }}
            />
          </Show>

          {/* Design mode overlay */}
          <Show when={designMode()}>
            <DesignModeOverlay
              hoveredElement={hoveredElement()}
              onElementHover={setHoveredElement}
            />
          </Show>

          {/* Loading indicator */}
          <Show when={loading()}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "2px",
                "background-color": "var(--accent-500)",
                animation: "loading-bar 1.5s ease-in-out infinite",
              }}
            />
          </Show>
        </div>

        {/* DevTools panel */}
        <Show when={devToolsOpen()}>
          <div
            style={{
              height: "200px",
              "min-height": "120px",
              "border-top": "1px solid var(--border-subtle)",
              display: "flex",
              "flex-direction": "column",
              "background-color": "var(--bg-1)",
              "flex-shrink": "0",
            }}
          >
            {/* DevTools tab bar */}
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "0",
                "border-bottom": "1px solid var(--border-subtle)",
                "padding-left": "8px",
                "flex-shrink": "0",
              }}
            >
              <DevToolTab
                icon={Terminal}
                label="Console"
                active={activeDevTab() === "console"}
                onClick={() => setActiveDevTab("console")}
                count={consoleLogs().length}
              />
              <DevToolTab
                icon={Network}
                label="Network"
                active={activeDevTab() === "network"}
                onClick={() => setActiveDevTab("network")}
                count={networkRequests().length}
              />
              <DevToolTab
                icon={Inspect}
                label="Elements"
                active={activeDevTab() === "elements"}
                onClick={() => setActiveDevTab("elements")}
              />
              <div style={{ flex: "1" }} />
              <NavButton
                onClick={() => {
                  if (activeDevTab() === "console") clearConsole()
                  else if (activeDevTab() === "network") clearNetwork()
                }}
                title="Clear"
              >
                <X size={12} />
              </NavButton>
              <NavButton onClick={() => setDevToolsOpen(false)} title="Close DevTools">
                <X size={14} />
              </NavButton>
            </div>

            {/* DevTools content */}
            <div
              style={{
                flex: "1 1 auto",
                overflow: "auto",
                "font-family": "var(--font-mono)",
                "font-size": "11px",
                padding: "8px 12px",
              }}
            >
              <Show when={activeDevTab() === "console"}>
                <Show
                  when={consoleLogs().length > 0}
                  fallback={
                    <EmptyDevTools message="Console is empty. Logs from same-origin pages (e.g. localhost) appear here automatically." />
                  }
                >
                  <For each={consoleLogs()}>
                    {(log) => (
                      <div
                        style={{
                          padding: "3px 0",
                          "border-bottom": "1px solid var(--border-subtle)",
                          color:
                            log.level === "error"
                              ? "var(--diff-remove)"
                              : log.level === "warn"
                                ? "var(--status-await)"
                                : "var(--text-secondary)",
                        }}
                      >
                        <span style={{ opacity: "0.5", "margin-right": "8px" }}>[{log.level}]</span>
                        {log.message}
                      </div>
                    )}
                  </For>
                </Show>
              </Show>

              <Show when={activeDevTab() === "network"}>
                <Show
                  when={networkRequests().length > 0}
                  fallback={
                    <EmptyDevTools message="No network requests captured. Fetch calls from same-origin pages appear here." />
                  }
                >
                  <div
                    style={{
                      display: "grid",
                      "grid-template-columns": "80px 1fr 60px 80px",
                      gap: "4px 12px",
                    }}
                  >
                    <div style={devHeaderStyle}>Method</div>
                    <div style={devHeaderStyle}>URL</div>
                    <div style={devHeaderStyle}>Status</div>
                    <div style={devHeaderStyle}>Time</div>
                    <For each={networkRequests()}>
                      {(req) => (
                        <>
                          <div style={{ color: "var(--accent-500)" }}>{req.method}</div>
                          <div
                            style={{
                              color: "var(--text-secondary)",
                              overflow: "hidden",
                              "text-overflow": "ellipsis",
                              "white-space": "nowrap",
                            }}
                          >
                            {req.url}
                          </div>
                          <div
                            style={{
                              color: req.status >= 400 ? "var(--diff-remove)" : "var(--diff-add)",
                            }}
                          >
                            {req.status}
                          </div>
                          <div style={{ color: "var(--text-tertiary)" }}>{req.time}ms</div>
                        </>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>

              <Show when={activeDevTab() === "elements"}>
                <Show
                  when={hoveredElement()}
                  fallback={
                    <EmptyDevTools message="Enable Design Mode and hover over elements to inspect them." />
                  }
                >
                  {(el) => (
                    <div>
                      <div style={{ color: "var(--accent-500)", "margin-bottom": "8px" }}>
                        &lt;{el().tagName.toLowerCase()}
                        <Show when={el().className}> class="{el().className}"</Show>
                        &gt;
                      </div>
                      <Show when={el().componentName}>
                        <div style={{ color: "var(--text-secondary)", "margin-bottom": "4px" }}>
                          Component:{" "}
                          <span style={{ color: "var(--diff-add)" }}>{el().componentName}</span>
                        </div>
                      </Show>
                      <Show when={el().filePath}>
                        <div style={{ color: "var(--text-secondary)", "margin-bottom": "4px" }}>
                          File:{" "}
                          <span style={{ color: "var(--text-primary)" }}>
                            {el().filePath}:{el().line}
                          </span>
                        </div>
                      </Show>
                      <div style={{ "margin-top": "8px", color: "var(--text-tertiary)" }}>
                        {el().rect.width.toFixed(0)} x {el().rect.height.toFixed(0)}px
                      </div>
                    </div>
                  )}
                </Show>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}

/* ─────────────────────── Design Mode Overlay ─────────────────────── */

const DesignModeOverlay: Component<{
  hoveredElement: ElementInfo | null
  onElementHover: (el: ElementInfo | null) => void
}> = (props) => {
  const [mousePos, setMousePos] = createSignal({ x: 0, y: 0 })

  const handleMouseMove = (e: MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY })
  }

  return (
    <div
      data-testid="design-mode-overlay"
      onMouseMove={handleMouseMove}
      style={{
        position: "absolute",
        inset: "0",
        cursor: "crosshair",
        "z-index": "10",
        "pointer-events": "auto",
      }}
    >
      {/* Crosshair guides */}
      <div
        style={{
          position: "absolute",
          left: "0",
          right: "0",
          top: `${mousePos().y}px`,
          height: "1px",
          "background-color": "rgba(255, 107, 26, 0.3)",
          "pointer-events": "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "0",
          bottom: "0",
          left: `${mousePos().x}px`,
          width: "1px",
          "background-color": "rgba(255, 107, 26, 0.3)",
          "pointer-events": "none",
        }}
      />

      {/* Design mode badge */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          "align-items": "center",
          gap: "6px",
          padding: "4px 12px",
          "background-color": "var(--accent-500)",
          color: "#fff",
          "border-radius": "12px",
          "font-size": "11px",
          "font-weight": "600",
          "z-index": "20",
          "box-shadow": "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        <MousePointer2 size={12} />
        Design Mode
      </div>

      {/* Highlighted element info tooltip */}
      <Show when={props.hoveredElement}>
        {(el) => (
          <div
            style={{
              position: "absolute",
              left: `${el().rect.x}px`,
              top: `${el().rect.y}px`,
              width: `${el().rect.width}px`,
              height: `${el().rect.height}px`,
              border: "2px solid var(--accent-500)",
              "background-color": "rgba(255, 107, 26, 0.08)",
              "pointer-events": "none",
              "z-index": "15",
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 4px)",
                left: "0",
                padding: "2px 6px",
                "background-color": "var(--accent-500)",
                color: "#fff",
                "font-size": "10px",
                "font-family": "var(--font-mono)",
                "border-radius": "3px",
                "white-space": "nowrap",
              }}
            >
              {el().tagName.toLowerCase()}
              <Show when={el().componentName}> ({el().componentName})</Show>
            </div>
          </div>
        )}
      </Show>
    </div>
  )
}

/* ─────────────────────── Shared Subcomponents ─────────────────────── */

const NavButton: Component<{
  onClick: () => void
  title: string
  disabled?: boolean
  children: unknown
}> = (props) => (
  <button
    type="button"
    onClick={props.onClick}
    disabled={props.disabled}
    title={props.title}
    style={{
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      width: "28px",
      height: "28px",
      border: "none",
      background: "transparent",
      color: props.disabled ? "var(--text-tertiary)" : "var(--text-secondary)",
      cursor: props.disabled ? "default" : "pointer",
      "border-radius": "4px",
      opacity: props.disabled ? "0.4" : "1",
      transition: "background-color var(--motion-fast)",
    }}
    onMouseEnter={(e) => {
      if (!props.disabled) e.currentTarget.style.backgroundColor = "var(--bg-2)"
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "transparent"
    }}
  >
    {props.children as never}
  </button>
)

const ToolbarButton: Component<{
  active: boolean
  onClick: () => void
  title: string
  children: unknown
}> = (props) => (
  <button
    type="button"
    onClick={props.onClick}
    title={props.title}
    style={{
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      width: "28px",
      height: "28px",
      border: props.active ? "1px solid var(--accent-500)" : "1px solid transparent",
      "background-color": props.active ? "rgba(255, 107, 26, 0.12)" : "transparent",
      color: props.active ? "var(--accent-500)" : "var(--text-secondary)",
      cursor: "pointer",
      "border-radius": "4px",
      transition: "all var(--motion-fast)",
    }}
    onMouseEnter={(e) => {
      if (!props.active) e.currentTarget.style.backgroundColor = "var(--bg-2)"
    }}
    onMouseLeave={(e) => {
      if (!props.active) e.currentTarget.style.backgroundColor = "transparent"
    }}
  >
    {props.children as never}
  </button>
)

const DevToolTab: Component<{
  icon: typeof Terminal
  label: string
  active: boolean
  onClick: () => void
  count?: number
}> = (props) => (
  <button
    type="button"
    onClick={props.onClick}
    style={{
      display: "flex",
      "align-items": "center",
      gap: "5px",
      padding: "6px 12px",
      border: "none",
      "border-bottom": `2px solid ${props.active ? "var(--accent-500)" : "transparent"}`,
      background: "transparent",
      color: props.active ? "var(--text-primary)" : "var(--text-tertiary)",
      "font-size": "11px",
      cursor: "pointer",
      transition: "color var(--motion-fast)",
    }}
    onMouseEnter={(e) => {
      if (!props.active) e.currentTarget.style.color = "var(--text-secondary)"
    }}
    onMouseLeave={(e) => {
      if (!props.active) e.currentTarget.style.color = "var(--text-tertiary)"
    }}
  >
    <props.icon size={12} />
    {props.label}
    <Show when={props.count != null && props.count > 0}>
      <span
        style={{
          "min-width": "16px",
          height: "16px",
          "border-radius": "8px",
          "background-color": "var(--bg-3)",
          display: "inline-flex",
          "align-items": "center",
          "justify-content": "center",
          "font-size": "9px",
          padding: "0 4px",
        }}
      >
        {props.count}
      </span>
    </Show>
  </button>
)

const EmptyDevTools: Component<{ message: string }> = (props) => (
  <div
    style={{
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      height: "100%",
      color: "var(--text-tertiary)",
      "font-size": "12px",
      "font-family": "var(--font-ui)",
    }}
  >
    {props.message}
  </div>
)

/* ─────────────────────── Types ─────────────────────── */

interface ConsoleEntry {
  level: "log" | "warn" | "error" | "info"
  message: string
  timestamp: number
}

interface NetworkEntry {
  method: string
  url: string
  status: number
  time: number
  timestamp: number
}

interface ElementInfo {
  tagName: string
  className: string
  componentName?: string
  filePath?: string
  line?: number
  rect: { x: number; y: number; width: number; height: number }
}

/* ─────────────────────── Styles ─────────────────────── */

const devHeaderStyle = {
  color: "var(--text-tertiary)",
  "font-size": "10px",
  "text-transform": "uppercase" as const,
  "letter-spacing": "0.05em",
  "padding-bottom": "4px",
  "border-bottom": "1px solid var(--border-subtle)",
} as const
