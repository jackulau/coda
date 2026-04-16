import { type Component, Show } from "solid-js"

interface Props {
  branch?: string
  agentStatus?: "idle" | "running" | "awaiting-input" | "error"
  diffCounts?: { additions: number; deletions: number }
}

export const StatusBar: Component<Props> = (props) => {
  return (
    <div data-testid="status-bar">
      <Show when={props.branch}>
        <span data-testid="status-branch">{props.branch}</span>
      </Show>
      <Show when={props.agentStatus}>
        <span data-testid="status-agent">{props.agentStatus}</span>
      </Show>
      <Show when={props.diffCounts}>
        <span data-testid="status-diff">
          +{props.diffCounts?.additions} −{props.diffCounts?.deletions}
        </span>
      </Show>
    </div>
  )
}
