// build-mac-lib.ts — pure logic for build-mac.sh: identity parsing, team-id
// extraction, env-override resolution, target triple selection. Isolated from
// shell & filesystem so tests run in <50ms.

const DEV_ID_LINE = /"(Developer ID Application:[^"]+)"/

/**
 * Parse `security find-identity -v -p codesigning` output and return the
 * first "Developer ID Application: ..." identity found. Other identity kinds
 * (Apple Development, Mac Developer, Apple Distribution) are ignored.
 */
export function parseFirstDeveloperIdIdentity(output: string): string | null {
  for (const line of output.split("\n")) {
    const m = line.match(DEV_ID_LINE)
    if (m) return m[1]
  }
  return null
}

/**
 * Extract the Team ID from a Developer ID Application CN. Team IDs are the
 * trailing 10-character alphanumeric token in the parentheses. Handles names
 * that themselves contain parentheses by preferring the LAST parenthesized
 * group.
 */
export function extractTeamId(cn: string): string | null {
  if (!cn) return null
  const matches = Array.from(cn.matchAll(/\(([A-Z0-9]{10})\)/g))
  if (matches.length === 0) return null
  return matches[matches.length - 1][1]
}

export type IdentitySource = "env" | "keychain" | "none"

export interface PickedIdentity {
  identity: string | null
  teamId: string | null
  source: IdentitySource
}

/**
 * Resolve which signing identity to use, enforcing the env > keychain > none
 * precedence. An empty-string env override counts as "not set".
 */
export function pickSigningIdentity(opts: {
  envOverride?: string | null
  keychainOutput?: string
}): PickedIdentity {
  const env = opts.envOverride?.trim()
  if (env) {
    return { identity: env, teamId: extractTeamId(env), source: "env" }
  }
  const fromKeychain = opts.keychainOutput
    ? parseFirstDeveloperIdIdentity(opts.keychainOutput)
    : null
  if (fromKeychain) {
    return { identity: fromKeychain, teamId: extractTeamId(fromKeychain), source: "keychain" }
  }
  return { identity: null, teamId: null, source: "none" }
}

/**
 * Map CODA_MAC_ARCH to a Rust target triple. Default is the universal build
 * so a single bundle covers both Apple Silicon and Intel.
 */
export function resolveBuildTarget(arch: string | undefined): string {
  if (arch === "arm64") return "aarch64-apple-darwin"
  if (arch === "x64") return "x86_64-apple-darwin"
  return "universal-apple-darwin"
}
