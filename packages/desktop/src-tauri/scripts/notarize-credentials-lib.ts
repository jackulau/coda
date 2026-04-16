// notarize-credentials-lib.ts — pure logic for notarize-credentials.sh.
//
// Validates CODA_APPLE_* env vars, produces human-readable output, and
// embeds the App-Specific Password setup instructions verbatim so the
// shell wrapper stays a thin adapter.

/** The user's actual Developer ID Application team id — hard-coded per spec. */
export const CODA_TEAM_ID = "95ZR2Y4GKR"

export const APP_SPECIFIC_PASSWORD_INSTRUCTIONS = `
How to generate an App-Specific Password:
  1. Sign in at https://appleid.apple.com
  2. Navigate to Sign-In and Security → App-Specific Passwords
  3. Click "Generate an app-specific password" (or "+")
  4. Name it "coda-notarize" (or anything memorable)
  5. Copy the 19-character password
  6. Store it as \`CODA_APPLE_APP_PASSWORD\` in your shell or .env
`.trim()

export interface Credentials {
  CODA_APPLE_ID?: string
  CODA_APPLE_TEAM_ID?: string
  CODA_APPLE_APP_PASSWORD?: string
}

export interface ValidateResult {
  exitCode: 0 | 1
  missing: Array<keyof Credentials>
}

const REQUIRED_KEYS: Array<keyof Credentials> = [
  "CODA_APPLE_ID",
  "CODA_APPLE_TEAM_ID",
  "CODA_APPLE_APP_PASSWORD",
]

export function validateCredentials(vars: Credentials): ValidateResult {
  const missing = REQUIRED_KEYS.filter((k) => !vars[k])
  return { exitCode: missing.length === 0 ? 0 : 1, missing }
}

export interface FormatInput {
  exitCode: 0 | 1
  missing: Array<keyof Credentials>
  vars: Credentials
}

export function formatCredentialsReport(input: FormatInput): string {
  const lines: string[] = []
  lines.push("=== notarize credentials check ===")

  for (const k of REQUIRED_KEYS) {
    const val = input.vars[k]
    if (!val) {
      lines.push(`  ✗ ${k}  (MISSING)`)
    } else if (k === "CODA_APPLE_APP_PASSWORD") {
      lines.push(`  ✓ ${k}  (set, redacted)`)
    } else {
      lines.push(`  ✓ ${k}  = ${val}`)
    }
  }

  lines.push("")
  lines.push(`Hint: your Team ID is CODA_APPLE_TEAM_ID=${CODA_TEAM_ID}`)

  if (input.exitCode === 0) {
    lines.push("")
    lines.push("All notarization credentials set.")
  } else {
    lines.push("")
    lines.push(APP_SPECIFIC_PASSWORD_INSTRUCTIONS)
  }

  return lines.join("\n")
}
