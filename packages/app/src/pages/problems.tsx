import type { Diagnostic } from "@coda/core/problems/panel"
import { type Component, For, Show } from "solid-js"

interface Props {
  diagnostics: Diagnostic[]
  onJump?: (d: Diagnostic) => void
}

export const ProblemsPanel: Component<Props> = (props) => {
  return (
    <div data-testid="problems-panel">
      <Show when={props.diagnostics.length === 0}>
        <div data-testid="problems-empty">No problems</div>
      </Show>
      <For each={props.diagnostics}>
        {(d) => (
          <button
            type="button"
            data-testid={`problem-${d.path}-${d.line}`}
            onClick={() => props.onJump?.(d)}
          >
            {d.severity}: {d.message} ({d.path}:{d.line})
          </button>
        )}
      </For>
    </div>
  )
}
