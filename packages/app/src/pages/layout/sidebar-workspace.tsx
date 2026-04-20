import { type Component, Show } from "solid-js"
import { useLayout } from "../../context/layout"
import { type WorkspaceUiRow, useWorkspaces } from "../../context/workspace"

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

  const onClick = () => {
    ws.selectWorkspace(props.workspace.id)
    layout.focusWorkspace(props.workspace.id)
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`workspace-${props.workspace.name}`}
      data-selected={isSelected() ? "true" : "false"}
      style={{
        width: "100%",
        height: "40px",
        padding: "0 10px",
        display: "flex",
        "align-items": "center",
        gap: "8px",
        "background-color": isSelected() ? "var(--bg-2)" : "transparent",
        "border-left": `2px solid ${isSelected() ? "var(--accent-500)" : "transparent"}`,
        transition: "background-color var(--motion-fast)",
        "text-align": "left",
        position: "relative",
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
        }}
      />
      <span
        style={{
          color: "var(--text-primary)",
          "font-size": "13px",
          flex: "0 1 auto",
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
            "margin-left": "auto",
            "white-space": "nowrap",
            "max-width": "120px",
            overflow: "hidden",
            "text-overflow": "ellipsis",
          }}
        >
          {props.workspace.branch}
        </span>
      </Show>
      <DiffSummary additions={props.workspace.additions} deletions={props.workspace.deletions} />
    </button>
  )
}

const DiffSummary: Component<{ additions: number; deletions: number }> = (p) => (
  <Show when={p.additions > 0 || p.deletions > 0}>
    <span
      data-testid="workspace-diff-counts"
      style={{
        "margin-left": "auto",
        "font-size": "11px",
        "font-family": "var(--font-mono)",
        "white-space": "nowrap",
        color: "var(--text-tertiary)",
      }}
    >
      <Show when={p.additions > 0}>
        <span style={{ color: "var(--diff-add)" }}>+{p.additions}</span>
      </Show>
      <Show when={p.additions > 0 && p.deletions > 0}>
        <span>&nbsp;</span>
      </Show>
      <Show when={p.deletions > 0}>
        <span style={{ color: "var(--diff-remove)" }}>−{p.deletions}</span>
      </Show>
    </span>
  </Show>
)
