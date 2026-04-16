export type AgentKind = "claude-code" | "codex" | "copilot" | "gemini" | "amp"

export interface AgentDefinition {
  kind: AgentKind
  binary: string
  startupArgs: string[]
  resumeFlag: string
  allowedEnv: string[]
}

export const DEFAULT_AGENTS: Record<AgentKind, AgentDefinition> = {
  "claude-code": {
    kind: "claude-code",
    binary: "claude",
    startupArgs: ["--effort", "max"],
    resumeFlag: "--resume",
    allowedEnv: ["ANTHROPIC_BASE_URL"],
  },
  codex: {
    kind: "codex",
    binary: "codex",
    startupArgs: [],
    resumeFlag: "--session",
    allowedEnv: ["OPENAI_BASE_URL"],
  },
  copilot: {
    kind: "copilot",
    binary: "gh",
    startupArgs: ["copilot", "chat"],
    resumeFlag: "--resume",
    allowedEnv: [],
  },
  gemini: {
    kind: "gemini",
    binary: "gemini",
    startupArgs: [],
    resumeFlag: "--continue",
    allowedEnv: [],
  },
  amp: {
    kind: "amp",
    binary: "amp",
    startupArgs: [],
    resumeFlag: "--resume",
    allowedEnv: [],
  },
}

export interface SpawnRequest {
  kind: AgentKind
  sessionId?: string
  extraArgs?: string[]
  cwd: string
}

export interface SpawnPlan {
  command: string
  args: string[]
  cwd: string
}

export function planSpawn(req: SpawnRequest): SpawnPlan {
  const def = DEFAULT_AGENTS[req.kind]
  if (!def) throw new Error(`unknown agent kind ${req.kind}`)
  const args = [...def.startupArgs]
  if (req.sessionId) {
    args.push(def.resumeFlag, req.sessionId)
  }
  if (req.extraArgs) args.push(...req.extraArgs)
  return { command: def.binary, args, cwd: req.cwd }
}

const STRIP_ENV = [
  "ANTHROPIC_API_KEY",
  "GITHUB_TOKEN",
  "GH_TOKEN",
  "OPENAI_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "CODA_SIDECAR_SECRET",
] as const

export function sanitizeEnv(
  base: Record<string, string>,
  def: AgentDefinition,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(base)) {
    if (STRIP_ENV.includes(k as (typeof STRIP_ENV)[number])) continue
    if (k.startsWith("CODA_") && !def.allowedEnv.includes(k)) continue
    out[k] = v
  }
  return out
}
