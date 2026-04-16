export interface TimeoutSpec {
  name: string
  ms: number
  behavior: string
}

export const TIMEOUTS = {
  "sidecar.rpc": { name: "sidecar.rpc", ms: 5_000, behavior: "Retry once, typed error" },
  "github.api": { name: "github.api", ms: 10_000, behavior: "Typed error, no retry" },
  "lsp.request": { name: "lsp.request", ms: 15_000, behavior: "Cancel; server stays up" },
  "pty.spawn": { name: "pty.spawn", ms: 5_000, behavior: "Error; suggest shell path" },
  "pty.write": { name: "pty.write", ms: 3_000, behavior: "Warn; mark degraded" },
  "sqlite.query": { name: "sqlite.query", ms: 2_000, behavior: "Typed error; no retry" },
  "sqlite.tx": { name: "sqlite.tx", ms: 10_000, behavior: "Rollback; typed error" },
  "fs.read": { name: "fs.read", ms: 3_000, behavior: "Typed error; locked hint" },
  "fs.write": { name: "fs.write", ms: 5_000, behavior: "Typed error; retry with tmp" },
  "git.worktreeAdd": {
    name: "git.worktreeAdd",
    ms: 30_000,
    behavior: "Abort; best-effort cleanup",
  },
  "git.clone": { name: "git.clone", ms: 600_000, behavior: "Abort; partial cleanup" },
  "update.manifest": {
    name: "update.manifest",
    ms: 10_000,
    behavior: "Silent fail; reschedule",
  },
  "update.download": {
    name: "update.download",
    ms: 300_000,
    behavior: "Abort; resume next check",
  },
  "mcp.toolCall": { name: "mcp.toolCall", ms: 60_000, behavior: "Cancel; log" },
  "port.scanCycle": { name: "port.scanCycle", ms: 2_000, behavior: "Skip cycle" },
  "browser.dns": { name: "browser.dns", ms: 5_000, behavior: 'Show "DNS slow" banner' },
  "webview.navigate": { name: "webview.navigate", ms: 15_000, behavior: "Offer external link" },
  "agent.resume": { name: "agent.resume", ms: 10_000, behavior: "Fresh-session prompt" },
  "tauri.command": { name: "tauri.command", ms: 5_000, behavior: "Typed error" },
  "worker.roundtrip": { name: "worker.roundtrip", ms: 3_000, behavior: "Restart worker" },
} as const satisfies Record<string, TimeoutSpec>

export type TimeoutName = keyof typeof TIMEOUTS

export function getTimeout(name: TimeoutName): TimeoutSpec {
  return TIMEOUTS[name]
}

export function listTimeouts(): TimeoutSpec[] {
  return Object.values(TIMEOUTS)
}
