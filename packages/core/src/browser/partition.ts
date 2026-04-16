import { sha256Hex } from "../util/sha256"

const PARTITION_PREFIX = "coda-ws-"

export function partitionKey(workspaceId: string, host: string): string {
  if (!workspaceId) throw new Error("workspaceId required")
  if (!host) throw new Error("host required")
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "")
  const hash = sha256Hex(`${workspaceId}|${normalized}`).slice(0, 16)
  return `${PARTITION_PREFIX}${hash}`
}

export function isLocalHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "")
  return h === "127.0.0.1" || h === "localhost" || h === "::1"
}

export interface NavGuardResult {
  allowed: boolean
  reason?: string
  normalizedUrl?: string
}

export function checkNavigation(url: string): NavGuardResult {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { allowed: false, reason: "invalid-url" }
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { allowed: false, reason: "non-http-protocol" }
  }
  if (!isLocalHost(parsed.hostname)) {
    return { allowed: false, reason: "non-local-host" }
  }
  return { allowed: true, normalizedUrl: parsed.toString() }
}
