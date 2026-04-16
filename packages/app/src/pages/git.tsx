import type { GitFileStatus } from "@coda/core/git/status"
import { type Component, For, Show } from "solid-js"

interface Props {
  files: GitFileStatus[]
  onStage?: (path: string) => void
  onUnstage?: (path: string) => void
  onCommit?: (message: string) => void
  branch?: string
}

export const GitPanel: Component<Props> = (props) => {
  return (
    <div data-testid="git-panel">
      <Show when={props.branch}>
        <div data-testid="git-branch">{props.branch}</div>
      </Show>
      <Show when={props.files.length === 0}>
        <div data-testid="git-clean">Clean working tree</div>
      </Show>
      <For each={props.files}>
        {(f) => (
          <div data-testid={`git-file-${f.path}`}>
            <span>{f.worktree}</span>
            <span>{f.path}</span>
            <button type="button" onClick={() => props.onStage?.(f.path)}>
              Stage
            </button>
          </div>
        )}
      </For>
    </div>
  )
}
