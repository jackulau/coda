import { type Component, ErrorBoundary, createSignal, onCleanup, onMount } from "solid-js"
import { CommandPalette, type PaletteCommand } from "./components/command-palette"
import { CrashBanner } from "./components/crash-banner"
import { EditorPanelProvider } from "./components/editor/editor-panel"
import { LayoutProvider } from "./context/layout"
import { WorkspaceProvider, useWorkspaces } from "./context/workspace"
import { CenterPanel } from "./pages/layout/center-panel"
import { RightRail } from "./pages/layout/right-rail"
import { Sidebar } from "./pages/layout/sidebar"
import { TitleBar } from "./pages/layout/title-bar"

const Shell: Component = () => {
  const ws = useWorkspaces()
  const [paletteOpen, setPaletteOpen] = createSignal(false)

  const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac")

  const onKey = (e: KeyboardEvent) => {
    const mod = isMac ? e.metaKey : e.ctrlKey
    if (mod && e.key.toLowerCase() === "p") {
      e.preventDefault()
      setPaletteOpen(true)
    }
  }
  onMount(() => window.addEventListener("keydown", onKey))
  onCleanup(() => window.removeEventListener("keydown", onKey))

  const commands = (): PaletteCommand[] => [
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
        <ErrorBoundary fallback={(e) => <div>Sidebar crash: {String(e)}</div>}>
          <Sidebar />
        </ErrorBoundary>
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
      <WorkspaceProvider>
        <EditorPanelProvider>
          <Shell />
        </EditorPanelProvider>
      </WorkspaceProvider>
    </LayoutProvider>
  )
}
