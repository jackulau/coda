import type { PortInfo } from "./index"

export interface ParsedPort {
  port: number
  pid: number
  command: string
  bindAddress: string
}

export function parseLsofOutput(stdout: string): ParsedPort[] {
  const out: ParsedPort[] = []
  const lines = stdout.split("\n")
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim()
    if (!line) continue
    const cols = line.split(/\s+/)
    if (cols.length < 9) continue
    const [command, pidStr, , , type, , , , addrCol] = cols
    if (type !== "IPv4" && type !== "IPv6") continue
    if (!addrCol || !addrCol.includes(":")) continue
    const lastColon = addrCol.lastIndexOf(":")
    const host = addrCol.slice(0, lastColon)
    const portPart = addrCol.slice(lastColon + 1)
    const port = Number.parseInt(portPart, 10)
    if (!Number.isFinite(port) || port <= 0 || port > 65535) continue
    const pid = Number.parseInt(pidStr ?? "", 10)
    if (!Number.isFinite(pid) || pid <= 0) continue
    out.push({
      port,
      pid,
      command: command ?? "?",
      bindAddress: host || "0.0.0.0",
    })
  }
  return out
}

export function parseSsOutput(stdout: string): ParsedPort[] {
  const out: ParsedPort[] = []
  const lines = stdout.split("\n")
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim()
    if (!line) continue
    const cols = line.split(/\s+/)
    if (cols.length < 5) continue
    let localCol: string | undefined
    for (const c of cols) {
      if (c.includes(":") && !c.startsWith("users") && c !== "*") {
        localCol = c
        break
      }
    }
    const userCol = cols[cols.length - 1]
    if (!localCol || !userCol) continue
    const lastColon = localCol.lastIndexOf(":")
    if (lastColon === -1) continue
    const portPart = localCol.slice(lastColon + 1)
    if (portPart === "*") continue
    const host = localCol.slice(0, lastColon).replace(/^\[|\]$/g, "")
    const port = Number.parseInt(portPart, 10)
    if (!Number.isFinite(port) || port <= 0 || port > 65535) continue
    const pidMatch = /pid=(\d+)/.exec(userCol)
    const cmdMatch = /"([^"]+)"/.exec(userCol)
    if (!pidMatch || !cmdMatch) continue
    out.push({
      port,
      pid: Number.parseInt(pidMatch[1] ?? "0", 10),
      command: cmdMatch[1] ?? "?",
      bindAddress: host || "0.0.0.0",
    })
  }
  return out
}

export function parseNetstatOutput(stdout: string): ParsedPort[] {
  const out: ParsedPort[] = []
  const lines = stdout.split("\n")
  for (const line of lines) {
    const t = line.trim()
    if (!t || !/^TCP/i.test(t)) continue
    if (!/LISTENING/i.test(t)) continue
    const cols = t.split(/\s+/)
    if (cols.length < 5) continue
    const local = cols[1]
    const pidStr = cols[cols.length - 1]
    if (!local) continue
    const lastColon = local.lastIndexOf(":")
    if (lastColon === -1) continue
    const host = local.slice(0, lastColon)
    const port = Number.parseInt(local.slice(lastColon + 1), 10)
    if (!Number.isFinite(port) || port <= 0 || port > 65535) continue
    const pid = Number.parseInt(pidStr ?? "0", 10)
    if (!Number.isFinite(pid) || pid <= 0) continue
    out.push({ port, pid, command: "?", bindAddress: host || "0.0.0.0" })
  }
  return out
}

export interface AttributionContext {
  pidToWorkspace: Map<number, string>
}

export function attribute(parsed: ParsedPort[], ctx: AttributionContext): PortInfo[] {
  return parsed.map((p) => {
    const workspaceId = ctx.pidToWorkspace.get(p.pid)
    return {
      port: p.port,
      pid: p.pid,
      command: p.command,
      bindAddress: p.bindAddress,
      external: workspaceId === undefined,
      ...(workspaceId !== undefined && { workspaceId }),
    }
  })
}
