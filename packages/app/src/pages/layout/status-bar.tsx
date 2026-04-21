import {
  AlertCircle,
  Circle,
  CircleDot,
  Columns3,
  GitBranch,
  Settings,
  TerminalSquare,
} from "lucide-solid"
import { type Component, Show } from "solid-js"

interface Props {
  branch?: string
  agentStatus?: "idle" | "running" | "awaiting-input" | "error"
  diffCounts?: { additions: number; deletions: number }
  onOpenSettings?: () => void
  onToggleTerminal?: () => void
  onToggleRightRail?: () => void
  terminalActive?: boolean
  rightRailActive?: boolean
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
        padding: "0 6px 0 10px",
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
      <span style={{ flex: "1 1 auto" }} />
      <StatusButton
        testid="status-toggle-terminal"
        label="Toggle terminal (⌘`)"
        active={props.terminalActive}
        onClick={() => props.onToggleTerminal?.()}
      >
        <TerminalSquare size={12} aria-hidden="true" />
      </StatusButton>
      <StatusButton
        testid="status-toggle-right-rail"
        label="Toggle review rail"
        active={props.rightRailActive}
        onClick={() => props.onToggleRightRail?.()}
      >
        <Columns3 size={12} aria-hidden="true" />
      </StatusButton>
      <StatusButton
        testid="status-open-settings"
        label="Settings (⌘,)"
        onClick={() => props.onOpenSettings?.()}
      >
        <Settings size={12} aria-hidden="true" />
      </StatusButton>
    </div>
  )
}

const StatusButton: Component<{
  testid: string
  label: string
  active?: boolean
  onClick: () => void
  children: unknown
}> = (props) => (
  <button
    type="button"
    data-testid={props.testid}
    aria-label={props.label}
    title={props.label}
    data-active={props.active ? "true" : "false"}
    onClick={props.onClick}
    style={{
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      width: "22px",
      height: "20px",
      background: "transparent",
      border: "none",
      color: props.active ? "var(--text-primary)" : "var(--text-tertiary)",
      cursor: "pointer",
      "border-radius": "3px",
      transition: "color var(--motion-fast), background-color var(--motion-fast)",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = "var(--bg-2)"
      e.currentTarget.style.color = "var(--text-primary)"
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = "transparent"
      e.currentTarget.style.color = props.active ? "var(--text-primary)" : "var(--text-tertiary)"
    }}
  >
    {props.children as never}
  </button>
)
