import type { ProjectInfo } from "@coda/core/project"
import { type Component, For, Show } from "solid-js"
import { useLayout } from "../../context/layout"
import { useWorkspaces } from "../../context/workspace"
import { WorkspaceRow } from "./sidebar-workspace"

interface Props {
  project: ProjectInfo
}

export const ProjectGroup: Component<Props> = (props) => {
  const layout = useLayout()
  const ws = useWorkspaces()

  const expanded = () => layout.state().expandedProjects[props.project.id] ?? props.project.expanded
  const rows = () => ws.workspacesForProject(props.project.id)

  return (
    <div data-testid={`project-${props.project.name}`}>
      <button
        type="button"
        onClick={() => layout.toggleProject(props.project.id)}
        style={{
          width: "100%",
          height: "28px",
          padding: "0 10px",
          display: "flex",
          "align-items": "center",
          gap: "6px",
          "font-size": "13px",
          "font-weight": 500,
          color: "var(--text-primary)",
          "text-align": "left",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: "10px",
            transition: "transform var(--motion-fast)",
            transform: expanded() ? "rotate(90deg)" : "rotate(0deg)",
            color: "var(--text-tertiary)",
          }}
        >
          ▸
        </span>
        <span>{props.project.name}</span>
        <span style={{ color: "var(--text-tertiary)", "margin-left": "4px" }}>
          ({rows().length})
        </span>
      </button>
      <Show when={expanded()}>
        <For each={rows()}>{(w) => <WorkspaceRow workspace={w} />}</For>
      </Show>
    </div>
  )
}
