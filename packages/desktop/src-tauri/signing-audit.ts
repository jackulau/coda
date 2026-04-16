#!/usr/bin/env bun
// signing-audit.ts — checks the signing story before `tauri build`.
//
// Reads the build environment, reports what will be signed (vs unsigned)
// per platform, and gates on CODA_REQUIRE_SIGNED=1. Unsigned builds in dev
// are intentionally fine (exit 0 with warnings). Prod release pipelines
// set CODA_REQUIRE_SIGNED=1 and the script fails closed.

export interface SigningEnv {
  // macOS
  CODA_APPLE_DEV_ID?: string // "Developer ID Application: ..."
  CODA_APPLE_PROVIDER?: string // team short name
  CODA_APPLE_ID?: string // notarization Apple ID
  CODA_APPLE_TEAM_ID?: string
  CODA_APPLE_APP_PASSWORD?: string

  // Windows
  CODA_WIN_CERT_THUMBPRINT?: string

  // Linux AppImage GPG signing
  CODA_GPG_KEY_ID?: string

  // Gate: require all present
  CODA_REQUIRE_SIGNED?: string
}

export type SigningStatus = "signed" | "unsigned" | "skipped"

export interface PlatformAuditResult {
  platform: "macos" | "windows" | "linux"
  status: SigningStatus
  missing: string[]
  reason?: string
}

export interface AuditReport {
  results: PlatformAuditResult[]
  requireSigned: boolean
  allSigned: boolean
  exitCode: 0 | 2
}

/**
 * Optional callback invoked when CODA_APPLE_DEV_ID is not set. Returning a
 * non-empty string tells the audit that a Developer ID Application identity
 * is available from the login keychain — sufficient to treat macOS as
 * `signed`. Returning `null` preserves the existing "unsigned, missing env"
 * behavior.
 */
export type KeychainProbe = () => string | null

export interface AuditOptions {
  keychainProbe?: KeychainProbe
}

export function auditSigningEnv(env: SigningEnv, opts: AuditOptions = {}): AuditReport {
  const results: PlatformAuditResult[] = [
    auditMac(env, opts.keychainProbe),
    auditWindows(env),
    auditLinux(env),
  ]
  const requireSigned = env.CODA_REQUIRE_SIGNED === "1"
  const allSigned = results.every((r) => r.status === "signed")
  const exitCode = requireSigned && !allSigned ? 2 : 0
  return { results, requireSigned, allSigned, exitCode }
}

function auditMac(env: SigningEnv, keychainProbe?: KeychainProbe): PlatformAuditResult {
  const missing: string[] = []

  // env > keychain precedence. If CODA_APPLE_DEV_ID is set, use it. Otherwise,
  // consult the keychain probe. The probe is optional so pure-env tests stay
  // deterministic.
  const devIdFromEnv = !!env.CODA_APPLE_DEV_ID
  let devIdFromKeychain = false
  if (!devIdFromEnv && keychainProbe) {
    const probed = keychainProbe()
    if (probed && probed.trim().length > 0) {
      devIdFromKeychain = true
    }
  }

  if (!devIdFromEnv && !devIdFromKeychain) missing.push("CODA_APPLE_DEV_ID")
  if (!env.CODA_APPLE_PROVIDER) missing.push("CODA_APPLE_PROVIDER")
  // Notarization creds are separate — they're needed for the post-bundle
  // staple step, not signing itself. If any of the notarization triplet is
  // partial, that's an error. If all three are absent, we'll produce a
  // signed-but-not-notarized build (which gets Gatekeeper-quarantined on
  // first launch).
  const notarizeVars = [env.CODA_APPLE_ID, env.CODA_APPLE_TEAM_ID, env.CODA_APPLE_APP_PASSWORD]
  const notarizeSet = notarizeVars.filter(Boolean).length
  if (notarizeSet > 0 && notarizeSet < 3) {
    if (!env.CODA_APPLE_ID) missing.push("CODA_APPLE_ID")
    if (!env.CODA_APPLE_TEAM_ID) missing.push("CODA_APPLE_TEAM_ID")
    if (!env.CODA_APPLE_APP_PASSWORD) missing.push("CODA_APPLE_APP_PASSWORD")
  }

  if (missing.length === 0) {
    const reason = devIdFromKeychain
      ? "Using Developer ID Application from login keychain (from keychain)."
      : undefined
    return { platform: "macos", status: "signed", missing: [], reason }
  }
  const coreSigningMissing = (!devIdFromEnv && !devIdFromKeychain) || !env.CODA_APPLE_PROVIDER
  return {
    platform: "macos",
    status: coreSigningMissing ? "unsigned" : "signed",
    missing,
    reason: coreSigningMissing
      ? "No Developer ID cert. Bundle will be produced unsigned (won't pass Gatekeeper)."
      : "Partial notarization credentials. Bundle will be signed but not notarized.",
  }
}

function auditWindows(env: SigningEnv): PlatformAuditResult {
  const missing: string[] = []
  if (!env.CODA_WIN_CERT_THUMBPRINT) missing.push("CODA_WIN_CERT_THUMBPRINT")

  if (missing.length === 0) {
    return { platform: "windows", status: "signed", missing: [] }
  }
  return {
    platform: "windows",
    status: "unsigned",
    missing,
    reason:
      "No code-signing cert thumbprint. MSI/NSIS will be unsigned (SmartScreen will warn users).",
  }
}

function auditLinux(env: SigningEnv): PlatformAuditResult {
  if (env.CODA_GPG_KEY_ID) {
    return { platform: "linux", status: "signed", missing: [] }
  }
  return {
    platform: "linux",
    status: "unsigned",
    missing: ["CODA_GPG_KEY_ID"],
    reason:
      "No GPG key for AppImage signing. AppImage will be unsigned (acceptable on Linux but not verifiable).",
  }
}

export function formatReport(report: AuditReport): string {
  const lines: string[] = []
  lines.push("=== Coda Signing Audit ===")
  for (const r of report.results) {
    const icon = r.status === "signed" ? "✅" : r.status === "unsigned" ? "⚠️ " : "⏭️ "
    lines.push(`${icon} ${r.platform.padEnd(8)} ${r.status}`)
    if (r.reason) lines.push(`     ${r.reason}`)
    if (r.missing.length > 0) lines.push(`     missing: ${r.missing.join(", ")}`)
  }
  lines.push(`\nCODA_REQUIRE_SIGNED=${report.requireSigned ? "1" : "0"}`)
  if (report.requireSigned && !report.allSigned) {
    lines.push("❌ FAIL — CODA_REQUIRE_SIGNED=1 but not all platforms are signed.")
  } else if (!report.allSigned) {
    lines.push("⚠️  Dev build OK. For a release set CODA_REQUIRE_SIGNED=1.")
  } else {
    lines.push("✅ All platforms signed.")
  }
  return lines.join("\n")
}

/** Default keychain probe — shells out to `security find-identity`. */
export function defaultKeychainProbe(): string | null {
  try {
    const { spawnSync } = require("node:child_process") as typeof import("node:child_process")
    const r = spawnSync("security", ["find-identity", "-v", "-p", "codesigning"], {
      encoding: "utf8",
    })
    if (r.status !== 0) return null
    for (const line of (r.stdout ?? "").split("\n")) {
      const m = line.match(/"(Developer ID Application:[^"]+)"/)
      if (m) return m[1]
    }
    return null
  } catch {
    return null
  }
}

// CLI entrypoint
if (import.meta.main) {
  const report = auditSigningEnv(process.env as unknown as SigningEnv, {
    keychainProbe: defaultKeychainProbe,
  })
  console.log(formatReport(report))
  process.exit(report.exitCode)
}
