import { type Component, For, Show } from "solid-js"

export interface DiffHunk {
  file: string
  header: string
  lines: string[]
}

interface Props {
  hunks: DiffHunk[]
  onJump?: (file: string) => void
}

export const DiffReviewPanel: Component<Props> = (props) => {
  return (
    <div data-testid="diff-review-panel">
      <Show when={props.hunks.length === 0}>
        <div data-testid="diff-review-empty">No diff</div>
      </Show>
      <For each={props.hunks}>
        {(h) => (
          <div data-testid={`diff-hunk-${h.file}`}>
            <button type="button" onClick={() => props.onJump?.(h.file)}>
              {h.file}
            </button>
            <pre>{h.header}</pre>
            <pre>{h.lines.join("\n")}</pre>
          </div>
        )}
      </For>
    </div>
  )
}
