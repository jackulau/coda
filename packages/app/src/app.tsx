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
import { TitleBar } from "./pages/layout/title-bar"

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
  })

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
        <ErrorBoundary fallback={(e) => <div>Right-rail crash: {String(e)}</div>}>
          <RightRail />
        </ErrorBoundary>
      </div>
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
