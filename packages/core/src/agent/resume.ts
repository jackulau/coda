export type AgentVendor = "claude-code" | "codex" | "copilot" | "gemini" | "amp"

export interface AgentResumeRequest {
  vendor: AgentVendor
  sessionId: string
  cwd: string
  continueFromLastTurn: boolean
  model?: string
}

export interface ResumeCommand {
  argv: string[]
  env: Record<string, string>
  note: string
}

export type ResumeResult =
  | { ok: true; command: ResumeCommand }
  | { ok: false; reason: "unknown-vendor" | "missing-session" }

export function buildResume(req: AgentResumeRequest): ResumeResult {
  if (!req.sessionId) return { ok: false, reason: "missing-session" }
  switch (req.vendor) {
    case "claude-code": {
      const argv = ["claude", req.continueFromLastTurn ? "--resume" : "--continue", req.sessionId]
      if (req.model) argv.push("--model", req.model)
      return {
        ok: true,
        command: {
          argv,
          env: {},
          note: `resume claude session ${req.sessionId}`,
        },
      }
    }
    case "codex": {
      return {
        ok: true,
        command: {
          argv: ["codex", "session", "resume", req.sessionId],
          env: {},
          note: `resume codex session ${req.sessionId}`,
        },
      }
    }
    case "copilot": {
      return {
        ok: true,
        command: {
          argv: ["gh", "copilot", "chat", "--session", req.sessionId],
          env: {},
          note: `resume copilot session ${req.sessionId}`,
        },
      }
    }
    case "gemini": {
      return {
        ok: true,
        command: {
          argv: ["gemini", "chat", "--session", req.sessionId],
          env: {},
          note: `resume gemini session ${req.sessionId}`,
        },
      }
    }
    case "amp": {
      return {
        ok: true,
        command: {
          argv: ["amp", "session", "--id", req.sessionId],
          env: {},
          note: `resume amp session ${req.sessionId}`,
        },
      }
    }
    default:
      return { ok: false, reason: "unknown-vendor" }
  }
}

export interface StreamEvent {
  type: "stdout" | "stderr" | "status" | "exit"
  payload: string
  ts: number
}

export function parseAgentOutput(line: string, ts: number): StreamEvent {
  if (line.startsWith("[status]")) {
    return { type: "status", payload: line.slice(8).trim(), ts }
  }
  if (line.startsWith("[exit]")) {
    return { type: "exit", payload: line.slice(6).trim(), ts }
  }
  if (line.startsWith("[err]")) {
    return { type: "stderr", payload: line.slice(5).trim(), ts }
  }
  return { type: "stdout", payload: line, ts }
}
