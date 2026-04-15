import { type Component, ErrorBoundary } from "solid-js"
import { LayoutProvider } from "./context/layout"
import { WorkspaceProvider } from "./context/workspace"
import { CenterPanel } from "./pages/layout/center-panel"
import { RightRail } from "./pages/layout/right-rail"
import { Sidebar } from "./pages/layout/sidebar"
import { TitleBar } from "./pages/layout/title-bar"

export const App: Component = () => {
  return (
    <LayoutProvider>
      <WorkspaceProvider>
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
        </ErrorBoundary>
      </WorkspaceProvider>
    </LayoutProvider>
  )
}
