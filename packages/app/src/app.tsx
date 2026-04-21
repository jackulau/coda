import { type Component, ErrorBoundary, createSignal, onCleanup, onMount } from "solid-js"
import { CommandPalette, type PaletteCommand } from "./components/command-palette"
import { CrashBanner } from "./components/crash-banner"
import { EditorPanelProvider, useBufferManager } from "./components/editor/editor-panel"
import { type HandlerMap, createShortcutBridge } from "./components/shortcut-bridge"
import { ToastProvider } from "./components/toasts"
import { LayoutProvider, useLayout } from "./context/layout"
import { useToasts } from "./context/toasts"
import { WorkspaceProvider, useWorkspaces } from "./context/workspace"
import { revealInFinder } from "./lib/ipc"
import { CenterPanel } from "./pages/layout/center-panel"
import { RightRail } from "./pages/layout/right-rail"
import { Sidebar } from "./pages/layout/sidebar"
import { StatusBar } from "./pages/layout/status-bar"
import { TerminalDock } from "./pages/layout/terminal-dock"
import { TitleBar } from "./pages/layout/title-bar"

const ShellStatusBar: Component = () => {
  const ws = useWorkspaces()
  const layout = useLayout()
  const selected = () => ws.workspaces().find((w) => w.id === ws.selectedId())
  const diffCounts = () => {
    const s = selected()
    return s ? { additions: s.additions, deletions: s.deletions } : undefined
  }
  return (
    <StatusBar
      branch={selected()?.branch}
      agentStatus={selected()?.agentStatus}
      diffCounts={diffCounts()}
      terminalActive={layout.state().terminalVisible}
      rightRailActive={layout.state().rightRailVisible}
      onOpenSettings={() => layout.navigate("settings")}
      onToggleTerminal={() => layout.toggleTerminal()}
      onToggleRightRail={() => layout.toggleRightRail()}
    />
  )
}

const Shell: Component = () => {
  const ws = useWorkspaces()
  const mgr = useBufferManager()
  const toasts = useToasts()
  const layout = useLayout()
  const [paletteOpen, setPaletteOpen] = createSignal(false)
  const [sidebarVisible, setSidebarVisible] = createSignal(true)

  const bridge = createShortcutBridge()

  const handlers = (): HandlerMap => ({
    "coda.palette.open": () => setPaletteOpen(true),
    "coda.workspace.open": () => {
      ws.addWorkspaceFromDialog().catch((err) => {
        toasts.error("Couldn't open folder", err instanceof Error ? err.message : String(err))
      })
    },
    "coda.tab.save": () => {
      const active = mgr.active()
      if (!active) return
      mgr.save(active).then(
        () => toasts.success("Saved"),
        (err) => toasts.error("Save failed", err instanceof Error ? err.message : String(err)),
      )
    },
    "coda.tab.close": () => {
      const active = mgr.active()
      if (!active) return
      const ok = mgr.close(active)
      if (!ok) {
        const confirmed =
          typeof window !== "undefined"
            ? window.confirm(`${active} has unsaved changes. Close anyway?`)
            : false
        if (confirmed) mgr.close(active, true)
      }
    },
    "coda.sidebar.toggle": () => setSidebarVisible((v) => !v),
    "coda.file.reveal": () => {
      const active = mgr.active()
      if (!active) {
        toasts.warn("No file selected to reveal")
        return
      }
      revealInFinder(active).catch((err) => {
        toasts.error("Reveal failed", err instanceof Error ? err.message : String(err))
      })
    },
    "coda.workspace.remove": () => {
      const id = ws.selectedId()
      if (!id) return
      ws.removeWorkspace(id).catch((err) => {
        toasts.error("Remove failed", err instanceof Error ? err.message : String(err))
      })
    },
  })

  onMount(() => {
    const cleanup = bridge.install(handlers)
    onCleanup(cleanup)

    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === ",") {
        e.preventDefault()
        layout.navigate("settings")
        return
      }
      if (mod && e.key === "`") {
        e.preventDefault()
        layout.toggleTerminal()
        return
      }
      if (mod && e.key === "j") {
        e.preventDefault()
        layout.toggleTerminal()
        return
      }
    }
    window.addEventListener("keydown", onKey)
    onCleanup(() => window.removeEventListener("keydown", onKey))
  })

  const navCommands = (): PaletteCommand[] => [
    {
      id: "coda.nav.settings",
      label: "Go to Settings",
      hint: "⌘,",
      run: () => layout.navigate("settings"),
    },
    {
      id: "coda.nav.welcome",
      label: "Go to Welcome",
      hint: "",
      run: () => layout.navigate("welcome"),
    },
    {
      id: "coda.nav.git",
      label: "Go to Git",
      hint: "",
      run: () => layout.navigate("git"),
    },
    {
      id: "coda.nav.problems",
      label: "Go to Problems",
      hint: "",
      run: () => layout.navigate("problems"),
    },
    {
      id: "coda.nav.search",
      label: "Go to Search",
      hint: "⌘K ⌘F",
      run: () => layout.navigate("search"),
    },
    {
      id: "coda.nav.pr-review",
      label: "Go to PR Review",
      hint: "",
      run: () => layout.navigate("pr-review"),
    },
    {
      id: "coda.nav.editor",
      label: "Go to Editor",
      hint: "",
      run: () => layout.navigate("editor"),
    },
    {
      id: "coda.view.toggle-terminal",
      label: "Toggle Terminal",
      hint: "⌘`",
      run: () => layout.toggleTerminal(),
    },
    {
      id: "coda.view.toggle-right-rail",
      label: "Toggle Review Changes Rail",
      hint: "",
      run: () => layout.toggleRightRail(),
    },
  ]

  const commands = (): PaletteCommand[] => {
    const extraCommands: PaletteCommand[] = [
      {
        id: "coda.workspace.open",
        label: "Open Folder…",
        hint: "⌘O",
        run: () => handlers()["coda.workspace.open"]?.(),
      },
      {
        id: "coda.tab.save",
        label: "Save",
        hint: "⌘S",
        run: () => handlers()["coda.tab.save"]?.(),
      },
      {
        id: "coda.tab.close",
        label: "Close Tab",
        hint: "⌘W",
        run: () => handlers()["coda.tab.close"]?.(),
      },
      {
        id: "coda.sidebar.toggle",
        label: "Toggle Sidebar",
        hint: "⌘B",
        run: () => handlers()["coda.sidebar.toggle"]?.(),
      },
      {
        id: "coda.file.reveal",
        label: "Reveal in Finder",
        hint: "⌘⇧R",
        run: () => handlers()["coda.file.reveal"]?.(),
      },
    ]
    return [
      ...navCommands(),
      ...extraCommands,
      ...ws.workspaces().map((w) => ({
        id: `workspace.${w.id}`,
        label: `Switch to workspace: ${w.name}`,
        hint: w.branch,
        run: () => ws.selectWorkspace(w.id),
      })),
      {
        id: "palette.close",
        label: "Close palette",
        hint: "Esc",
        run: () => setPaletteOpen(false),
      },
    ]
  }

  // Reference layout so the hook is actually consumed (persists widths on
  // change through its internal effect chain).
  layout

  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <div style={{ padding: "16px", color: "var(--diff-remove)" }}>
          App crashed: {String(err)}
          <button type="button" onClick={reset}>
            Reset
          </button>
        </div>
      )}
    >
      <TitleBar />
      <div
        style={{
          display: "flex",
          flex: "1 1 auto",
          "min-height": 0,
          "border-top": "1px solid var(--border-subtle)",
        }}
      >
        {sidebarVisible() && (
          <ErrorBoundary fallback={(e) => <div>Sidebar crash: {String(e)}</div>}>
            <Sidebar />
          </ErrorBoundary>
        )}
        <ErrorBoundary fallback={(e) => <div>Center crash: {String(e)}</div>}>
          <CenterPanel />
        </ErrorBoundary>
        {layout.state().rightRailVisible && (
          <ErrorBoundary fallback={(e) => <div>Right-rail crash: {String(e)}</div>}>
            <RightRail />
          </ErrorBoundary>
        )}
      </div>
      {layout.state().terminalVisible && (
        <ErrorBoundary fallback={(e) => <div>Terminal crash: {String(e)}</div>}>
          <TerminalDock onClose={() => layout.toggleTerminal()} />
        </ErrorBoundary>
      )}
      <ShellStatusBar />

      <CommandPalette
        commands={commands()}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
      <CrashBanner />
    </ErrorBoundary>
  )
}

export const App: Component = () => {
  return (
    <LayoutProvider>
      <ToastProvider>
        <WorkspaceProvider>
          <EditorPanelProvider>
            <Shell />
          </EditorPanelProvider>
        </WorkspaceProvider>
      </ToastProvider>
    </LayoutProvider>
  )
}
