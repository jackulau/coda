import type { Component, JSX } from "solid-js"

export type AgentKind = "shell" | "claude" | "codex" | "gemini" | "cursor"

interface LogoProps {
  size?: number
  title?: string
  style?: JSX.CSSProperties
}

const box = (size: number) => ({
  width: `${size}px`,
  height: `${size}px`,
  display: "inline-block",
  flex: "0 0 auto",
})

/**
 * Lightweight, monochrome SVG marks for the agent quick-launch tabs. Colors
 * come from CSS (`.coda-agent-*` classes) so the same glyph can render neutral
 * in menus and accented in tabs.
 */

export const ClaudeLogo: Component<LogoProps> = (props) => {
  const size = props.size ?? 14
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ ...box(size), ...(props.style ?? {}) }}
      aria-label={props.title}
      role="img"
      fill="currentColor"
    >
      <path d="M12 1.5 13.55 9 21 10.5 13.55 12 12 19.5 10.45 12 3 10.5 10.45 9Z" />
      <path
        d="M12 6.5 12.75 9.75 16 10.5 12.75 11.25 12 14.5 11.25 11.25 8 10.5 11.25 9.75Z"
        opacity="0.55"
      />
    </svg>
  )
}

export const CodexLogo: Component<LogoProps> = (props) => {
  const size = props.size ?? 14
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ ...box(size), ...(props.style ?? {}) }}
      aria-label={props.title}
      role="img"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M7 10a5 5 0 0 1 10 0 5 5 0 0 1-10 4" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

export const GeminiLogo: Component<LogoProps> = (props) => {
  const size = props.size ?? 14
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ ...box(size), ...(props.style ?? {}) }}
      aria-label={props.title}
      role="img"
      fill="currentColor"
    >
      <path d="M12 2 13 11 22 12 13 13 12 22 11 13 2 12 11 11Z" />
    </svg>
  )
}

export const CursorLogo: Component<LogoProps> = (props) => {
  const size = props.size ?? 14
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ ...box(size), ...(props.style ?? {}) }}
      aria-label={props.title}
      role="img"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linejoin="round"
    >
      <path d="M4 3 20 12 12 14 10 22 4 3Z" fill="currentColor" fill-opacity="0.35" />
    </svg>
  )
}

export const ShellLogo: Component<LogoProps> = (props) => {
  const size = props.size ?? 14
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ ...box(size), ...(props.style ?? {}) }}
      aria-label={props.title}
      role="img"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M5 8 10 12 5 16" />
      <path d="M13 16h6" />
    </svg>
  )
}

export interface AgentMeta {
  kind: AgentKind
  label: string
  command: string
  logo: Component<LogoProps>
  className: string
}

export const AGENTS: ReadonlyArray<AgentMeta> = [
  { kind: "shell", label: "Shell", command: "", logo: ShellLogo, className: "coda-agent-shell" },
  {
    kind: "claude",
    label: "claude",
    command: "claude",
    logo: ClaudeLogo,
    className: "coda-agent-claude",
  },
  {
    kind: "codex",
    label: "codex",
    command: "codex",
    logo: CodexLogo,
    className: "coda-agent-codex",
  },
  {
    kind: "gemini",
    label: "gemini",
    command: "gemini",
    logo: GeminiLogo,
    className: "coda-agent-gemini",
  },
  {
    kind: "cursor",
    label: "cursor",
    command: "cursor-agent",
    logo: CursorLogo,
    className: "coda-agent-cursor",
  },
]

const SHELL_FALLBACK: AgentMeta = AGENTS[0] as AgentMeta

export function agentMeta(kind: AgentKind): AgentMeta {
  return AGENTS.find((a) => a.kind === kind) ?? SHELL_FALLBACK
}

export const AgentLogo: Component<{ kind: AgentKind; size?: number; colored?: boolean }> = (
  props,
) => {
  const meta = () => agentMeta(props.kind)
  return (
    <span
      class={props.colored === false ? undefined : meta().className}
      style={{ display: "inline-flex" }}
    >
      {meta().logo({ size: props.size, title: meta().label })}
    </span>
  )
}
