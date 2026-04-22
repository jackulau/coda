import { type Component, Match, Show, Switch } from "solid-js"
import { EditorPanel, useBufferManager } from "../../components/editor/editor-panel"
import { ResizeHandle } from "../../components/resize-handle"
import { useGitStatus } from "../../context/git-status"
import { type CenterPage, useLayout } from "../../context/layout"
import { useWorkspaces } from "../../context/workspace"
import { BrowserPanel } from "../browser/browser-panel"
import { GitPanel } from "../git"
import { AddProjectForm } from "../onboarding/add-project"
import { PrReviewPanel } from "../pr-review"
import { ProblemsPanel } from "../problems"
import { SearchPage } from "../search"
import { SettingsPage } from "../settings/settings"
import { WelcomePage } from "../welcome"
import { FileTreeLive } from "./file-tree"

export const CenterPanel: Component = () => {
  const layout = useLayout()
  const page = (): CenterPage => layout.state().currentPage

  return (
    <main
      data-testid="center-panel"
      data-page={page()}
      style={{
        flex: "1 1 auto",
        display: "flex",
        "flex-direction": "row",
        "min-width": 0,
        "background-color": "var(--bg-0)",
      }}
    >
      <Switch fallback={<EditorView />}>
        <Match when={page() === "welcome"}>
          <PageWrap name="welcome">
            <WelcomePage
              onAddProject={() => layout.navigate("onboarding")}
              onSkip={() => layout.navigate("editor")}
            />
          </PageWrap>
        </Match>
        <Match when={page() === "onboarding"}>
          <PageWrap name="onboarding">
            <div style={{ padding: "24px", "max-width": "480px" }}>
              <h2 style={{ margin: "0 0 12px", "font-size": "16px" }}>Add a project</h2>
              <AddProjectForm onSubmit={() => layout.navigate("editor")} />
            </div>
          </PageWrap>
        </Match>
        <Match when={page() === "git"}>
          <PageWrap name="git">
            <GitPanelWired />
          </PageWrap>
        </Match>
        <Match when={page() === "problems"}>
          <PageWrap name="problems">
            <ProblemsPanel diagnostics={[]} />
          </PageWrap>
        </Match>
        <Match when={page() === "search"}>
          <PageWrap name="search">
            <SearchPageWired />
          </PageWrap>
        </Match>
        <Match when={page() === "pr-review"}>
          <PageWrap name="pr-review">
            <PrReviewWired />
          </PageWrap>
        </Match>
        <Match when={page() === "settings"}>
          <PageWrap name="settings">
            <SettingsPage onClose={() => layout.navigate("editor")} />
          </PageWrap>
        </Match>
        <Match when={page() === "browser"}>
          <PageWrap name="browser">
            <BrowserPanel />
          </PageWrap>
        </Match>
      </Switch>
    </main>
  )
}

const PageWrap: Component<{ name: string; children: unknown }> = (props) => (
  <div
    data-testid={`page-${props.name}`}
    style={{
      flex: "1 1 auto",
      display: "flex",
      "flex-direction": "column",
      "min-width": 0,
      overflow: "auto",
    }}
  >
    {props.children as never}
  </div>
)

const SearchPageWired: Component = () => {
  const ws = useWorkspaces()
  const layout = useLayout()
  const mgr = useBufferManager()
  const focused = () => ws.workspaces().find((w) => w.id === ws.selectedId())
  return (
    <SearchPage
      cwd={focused()?.cwd}
      onOpenFile={(path, _line) => {
        layout.navigate("editor")
        void mgr.open(path).catch(() => {})
      }}
    />
  )
}

const GitPanelWired: Component = () => {
  const ws = useWorkspaces()
  const git = useGitStatus()
  const layout = useLayout()
  const mgr = useBufferManager()
  const focused = () => ws.workspaces().find((w) => w.id === ws.selectedId())
  return (
    <GitPanel
      cwd={focused()?.cwd}
      files={git.files()}
      branch={focused()?.branch}
      onOpenFile={(path) => {
        layout.navigate("editor")
        void mgr.open(path).catch(() => {})
      }}
    />
  )
}

const PrReviewWired: Component = () => {
  const ws = useWorkspaces()
  const focused = () => ws.workspaces().find((w) => w.id === ws.selectedId())
  return <PrReviewPanel cwd={focused()?.cwd} />
}

const EditorView: Component = () => {
  const ws = useWorkspaces()
  const mgr = useBufferManager()
  const layout = useLayout()
  const focused = () => ws.workspaces().find((w) => w.id === ws.selectedId())
  return (
    <Show
      when={focused()}
      fallback={
        <div
          data-testid="page-editor-empty"
          style={{
            flex: "1 1 auto",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            color: "var(--text-tertiary)",
            "font-size": "12px",
          }}
        >
          Select a workspace from the sidebar.
        </div>
      }
    >
      {(w) => (
        <>
          <div
            data-testid="center-panel-tree"
            style={{
              width: `${layout.state().centerTreeWidth}px`,
              "min-width": "180px",
              "max-width": "480px",
              "border-right": "1px solid var(--border-subtle)",
              display: "flex",
              "flex-direction": "column",
              flex: "0 0 auto",
            }}
          >
            <FileTreeLive
              rootPath={w().cwd}
              onOpenFile={(p) => {
                void mgr.open(p).catch(() => {
                  /* toasts handled by caller */
                })
              }}
            />
          </div>
          <ResizeHandle
            direction="horizontal"
            ariaLabel="Resize file tree"
            testId="center-tree-resize-handle"
            onDrag={(d) => layout.setCenterTreeWidth(layout.state().centerTreeWidth + d)}
            onNudge={(d) => layout.setCenterTreeWidth(layout.state().centerTreeWidth + d)}
          />
          <EditorPanel />
        </>
      )}
    </Show>
  )
}
