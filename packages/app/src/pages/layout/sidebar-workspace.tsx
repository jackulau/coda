import { ChevronDown, ChevronRight } from "lucide-solid"
import { type Component, Show } from "solid-js"
import { useLayout } from "../../context/layout"
import { type WorkspaceUiRow, useWorkspaces } from "../../context/workspace"
import { FileTreeLive } from "./file-tree"

interface Props {
  workspace: WorkspaceUiRow
}

const STATUS_COLOR: Record<WorkspaceUiRow["agentStatus"], string> = {
  idle: "var(--status-idle)",
  running: "var(--status-run)",
  "awaiting-input": "var(--status-await)",
  error: "var(--status-error)",
}

export const WorkspaceRow: Component<Props> = (props) => {
  const ws = useWorkspaces()
  const layout = useLayout()
  const isSelected = () => ws.selectedId() === props.workspace.id
  const isExpanded = () => layout.state().expandedWorkspaceId === props.workspace.id

  const onSelect = () => {
    ws.selectWorkspace(props.workspace.id)
    layout.focusWorkspace(props.workspace.id)
  }

  const onToggle = (e: MouseEvent) => {
    e.stopPropagation()
    layout.toggleWorkspaceTree(props.workspace.id)
  }

  return (
    <div data-testid={`workspace-row-${props.workspace.name}`}>
      <div
        data-selected={isSelected() ? "true" : "false"}
        style={{
          width: "100%",
          height: "40px",
          display: "flex",
          "align-items": "center",
          "background-color": isSelected() ? "var(--bg-2)" : "transparent",
          "border-left": `2px solid ${isSelected() ? "var(--accent-500)" : "transparent"}`,
          transition: "background-color var(--motion-fast)",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          data-testid={`workspace-tree-toggle-${props.workspace.name}`}
          aria-label={isExpanded() ? "Collapse file tree" : "Expand file tree"}
          aria-expanded={isExpanded()}
          style={{
            display: "inline-flex",
            "align-items": "center",
            "justify-content": "center",
            width: "18px",
            height: "18px",
            "margin-left": "4px",
            "border-radius": "3px",
            background: "transparent",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            padding: 0,
            "flex-shrink": 0,
          }}
        >
          <Show when={isExpanded()} fallback={<ChevronRight size={13} aria-hidden="true" />}>
            <ChevronDown size={13} aria-hidden="true" />
          </Show>
        </button>
        <button
          type="button"
          onClick={onSelect}
          data-testid={`workspace-${props.workspace.name}`}
          data-selected={isSelected() ? "true" : "false"}
          style={{
            flex: "1 1 auto",
            height: "100%",
            padding: "0 10px 0 6px",
            display: "flex",
            "align-items": "center",
            gap: "6px",
            background: "transparent",
            border: "none",
            "text-align": "left",
            cursor: "pointer",
            "min-width": 0,
          }}
        >
          <span
            aria-label={`agent ${props.workspace.agentStatus}`}
            style={{
              width: "8px",
              height: "8px",
              "border-radius": "50%",
              "background-color": STATUS_COLOR[props.workspace.agentStatus],
              "box-shadow": "0 0 0 2px var(--bg-1)",
              animation: props.workspace.agentStatus === "running" ? "pulse 1.6s infinite" : "none",
              "flex-shrink": 0,
            }}
          />
          <span
            style={{
              color: "var(--text-primary)",
              "font-size": "13px",
              flex: "1 1 auto",
              "white-space": "nowrap",
              overflow: "hidden",
              "text-overflow": "ellipsis",
            }}
          >
            {props.workspace.name}
          </span>
          <Show when={props.workspace.branch}>
            <span
              style={{
                color: "var(--text-tertiary)",
                "font-size": "11px",
                "white-space": "nowrap",
                "max-width": "120px",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "flex-shrink": 0,
              }}
            >
              {props.workspace.branch}
            </span>
          </Show>
        </button>
      </div>
      <Show when={isExpanded()}>
        <div
          data-testid={`workspace-tree-${props.workspace.name}`}
          style={{
            "padding-left": "16px",
            "border-left": "1px dashed var(--border-subtle)",
            "margin-left": "14px",
          }}
        >
          <FileTreeLive
            rootPath={props.workspace.cwd}
            onOpenFile={(p) => {
              ws.selectWorkspace(props.workspace.id)
              layout.focusWorkspace(props.workspace.id)
              const evt = new CustomEvent("coda:open-file", { detail: { path: p } })
              window.dispatchEvent(evt)
            }}
          />
        </div>
      </Show>
    </div>
  )
}
