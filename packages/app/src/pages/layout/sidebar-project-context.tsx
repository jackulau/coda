import { type Component, For } from "solid-js"

export interface ProjectContextMenuAction {
  id: "rename" | "remove" | "reveal" | "clone-as-worktree"
  label: string
}

const DEFAULT_ACTIONS: ProjectContextMenuAction[] = [
  { id: "rename", label: "Rename" },
  { id: "remove", label: "Remove" },
  { id: "reveal", label: "Reveal in Finder" },
  { id: "clone-as-worktree", label: "Clone as Worktree" },
]

interface Props {
  actions?: ProjectContextMenuAction[]
  onSelect?: (id: ProjectContextMenuAction["id"]) => void
}

export const ProjectContextMenu: Component<Props> = (props) => {
  const items = () => props.actions ?? DEFAULT_ACTIONS
  return (
    <ul data-testid="project-context-menu" role="menu">
      <For each={items()}>
        {(a) => (
          <li data-testid={`project-ctx-${a.id}`}>
            <button type="button" role="menuitem" onClick={() => props.onSelect?.(a.id)}>
              {a.label}
            </button>
          </li>
        )}
      </For>
    </ul>
  )
}
