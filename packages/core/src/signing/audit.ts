export interface SigningContext {
  platform: "darwin" | "linux" | "win32"
  env: Record<string, string | undefined>
  fs: { exists(path: string): boolean }
}

export type SigningCheckId =
  | "apple-developer-id"
  | "windows-pfx"
  | "linux-gpg"
  | "updater-pubkey"
  | "notarization-apple-id"

export interface SigningCheckResult {
  id: SigningCheckId
  ok: boolean
  reason?: string
  fix?: string
}

export function auditSigning(ctx: SigningContext): SigningCheckResult[] {
  const out: SigningCheckResult[] = []

  if (ctx.platform === "darwin") {
    if (!ctx.env.APPLE_SIGNING_IDENTITY) {
      out.push({
        id: "apple-developer-id",
        ok: false,
        reason: "APPLE_SIGNING_IDENTITY not set",
        fix: 'export APPLE_SIGNING_IDENTITY="Developer ID Application: <Team>"',
      })
    } else {
      out.push({ id: "apple-developer-id", ok: true })
    }
    if (!ctx.env.APPLE_ID || !ctx.env.APPLE_TEAM_ID) {
      out.push({
        id: "notarization-apple-id",
        ok: false,
        reason: "APPLE_ID / APPLE_TEAM_ID not set for notarytool",
        fix: "export APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD",
      })
    } else {
      out.push({ id: "notarization-apple-id", ok: true })
    }
  }

  if (ctx.platform === "win32") {
    const pfx = ctx.env.WINDOWS_PFX_PATH
    if (!pfx || !ctx.fs.exists(pfx)) {
      out.push({
        id: "windows-pfx",
        ok: false,
        reason: pfx ? `PFX missing on disk: ${pfx}` : "WINDOWS_PFX_PATH not set",
        fix: "Place the .pfx and point WINDOWS_PFX_PATH at it, plus WINDOWS_PFX_PASSWORD",
      })
    } else {
      out.push({ id: "windows-pfx", ok: true })
    }
  }

  if (ctx.platform === "linux") {
    if (!ctx.env.GPG_KEY_ID) {
      out.push({
        id: "linux-gpg",
        ok: false,
        reason: "GPG_KEY_ID not set — AppImage + .deb won't be signed",
        fix: "export GPG_KEY_ID=<long-id>",
      })
    } else {
      out.push({ id: "linux-gpg", ok: true })
    }
  }

  if (!ctx.env.TAURI_UPDATER_PUBKEY) {
    out.push({
      id: "updater-pubkey",
      ok: false,
      reason: "TAURI_UPDATER_PUBKEY not set — auto-updater disabled",
      fix: "tauri signer generate && export TAURI_UPDATER_PUBKEY=<pub>",
    })
  } else {
    out.push({ id: "updater-pubkey", ok: true })
  }

  return out
}

export function blockingIssues(results: SigningCheckResult[]): SigningCheckResult[] {
  return results.filter((r) => !r.ok)
}
