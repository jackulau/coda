// verify-signed-lib.ts — pure logic for post-build signature verification.
//
// Shells out (via a test-injectable seam) to codesign + spctl. All parsing
// lives here so the shell wrapper is a 1-line "exit with my exitCode" call.

export const EXIT_OK = 0
export const EXIT_BAD_ARGS = 1
export const EXIT_CODESIGN_FAIL = 2
export const EXIT_GATEKEEPER_FAIL = 3
export const EXIT_MISSING_APP = 4

export type ExitCode =
  | typeof EXIT_OK
  | typeof EXIT_BAD_ARGS
  | typeof EXIT_CODESIGN_FAIL
  | typeof EXIT_GATEKEEPER_FAIL
  | typeof EXIT_MISSING_APP

export interface RunResult {
  exitCode: number
  stdout: string
  stderr: string
}

export interface VerifyEnv {
  fileExists(path: string): boolean
  runCommand(command: string, args: string[]): RunResult
}

export interface VerifyOptions {
  appPath: string
  env: VerifyEnv
}

export interface VerifyResult {
  exitCode: ExitCode
  identity: string | null
  error?: string
}

/**
 * Parse the first `Authority=Developer ID Application: ...` line from
 * `codesign -dv --verbose=4` output. Returns null if no Developer ID
 * Application authority is present (unsigned or ad-hoc signed).
 */
export function parseSigningIdentityFromCodesignDv(output: string): string | null {
  for (const line of output.split("\n")) {
    const m = line.match(/^Authority=(Developer ID Application:.+)$/)
    if (m) return m[1].trim()
  }
  return null
}

export function verifySignedApp(opts: VerifyOptions): VerifyResult {
  const { appPath, env } = opts

  if (!appPath) {
    return { exitCode: EXIT_BAD_ARGS, identity: null, error: "usage: verify-signed.sh <app>" }
  }

  if (!env.fileExists(appPath)) {
    return {
      exitCode: EXIT_MISSING_APP,
      identity: null,
      error: `app bundle not found: ${appPath}`,
    }
  }

  const verify = env.runCommand("codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=4",
    appPath,
  ])
  if (verify.exitCode !== 0) {
    return {
      exitCode: EXIT_CODESIGN_FAIL,
      identity: null,
      error: (verify.stderr || verify.stdout || `codesign --verify exit ${verify.exitCode}`).trim(),
    }
  }

  const display = env.runCommand("codesign", ["-dv", "--verbose=4", appPath])
  const identity =
    parseSigningIdentityFromCodesignDv(display.stdout) ??
    parseSigningIdentityFromCodesignDv(display.stderr)

  const assess = env.runCommand("spctl", ["--assess", "--type=execute", "--verbose=4", appPath])
  if (assess.exitCode !== 0) {
    return {
      exitCode: EXIT_GATEKEEPER_FAIL,
      identity,
      error: (assess.stderr || assess.stdout || `Gatekeeper rejected ${appPath}`).trim(),
    }
  }

  return { exitCode: EXIT_OK, identity }
}
