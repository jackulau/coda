import { AlertCircle, Circle, CircleDot, GitBranch } from "lucide-solid"
import { type Component, Show } from "solid-js"

interface Props {
  branch?: string
  agentStatus?: "idle" | "running" | "awaiting-input" | "error"
  diffCounts?: { additions: number; deletions: number }
}

const AGENT_LABEL: Record<NonNullable<Props["agentStatus"]>, string> = {
  idle: "idle",
  running: "running",
  "awaiting-input": "awaiting input",
  error: "error",
}

const AGENT_COLOR: Record<NonNullable<Props["agentStatus"]>, string> = {
  idle: "var(--status-idle)",
  running: "var(--status-run)",
  "awaiting-input": "var(--status-await)",
  error: "var(--status-error)",
}

const agentIconFor = (status: NonNullable<Props["agentStatus"]>) => {
  if (status === "error") return AlertCircle
  if (status === "running") return CircleDot
  return Circle
}

export const StatusBar: Component<Props> = (props) => {
  return (
    <div
      data-testid="status-bar"
      style={{
        height: "24px",
        padding: "0 10px",
        "border-top": "1px solid var(--border-subtle)",
        "background-color": "var(--bg-1)",
        display: "flex",
        "align-items": "center",
        gap: "14px",
        flex: "0 0 auto",
        "font-family": "var(--font-mono)",
        "font-size": "11px",
        color: "var(--text-tertiary)",
        "user-select": "none",
      }}
    >
      <Show when={props.branch}>
        <span
          data-testid="status-branch"
          style={{ display: "inline-flex", "align-items": "center", gap: "4px" }}
        >
          <GitBranch size={11} aria-hidden="true" />
          {props.branch}
        </span>
      </Show>
      <Show when={props.agentStatus}>
        {(status) => {
          const AgentIcon = agentIconFor(status())
          return (
            <span
              data-testid="status-agent"
              style={{
                display: "inline-flex",
                "align-items": "center",
                gap: "4px",
                color: AGENT_COLOR[status()],
              }}
            >
              <AgentIcon size={11} aria-hidden="true" />
              {AGENT_LABEL[status()]}
            </span>
          )
        }}
      </Show>
      <Show when={props.diffCounts}>
        <span data-testid="status-diff">
          +{props.diffCounts?.additions} −{props.diffCounts?.deletions}
        </span>
      </Show>
    </div>
  )
}
