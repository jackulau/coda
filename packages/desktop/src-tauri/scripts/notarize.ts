#!/usr/bin/env bun
// notarize.ts — macOS post-bundle notarization driver.
//
// Flow:
//   1. Resolve the produced bundle (`.app.zip` or directory ready to ship).
//   2. Call `xcrun notarytool submit --wait` with the Apple ID / team ID /
//      app-specific password from env vars.
//   3. Parse the notarytool JSON/plain output; non-zero exit on rejection.
//   4. On success, `xcrun stapler staple` the ticket.
//   5. `--dry-run` validates env + file existence without touching the network.
//
// Side effects are injected through a `NotarizeEnv` seam so tests don't call
// out to Apple or spawn xcrun.

export interface NotarizeVars {
  CODA_APPLE_ID?: string
  CODA_APPLE_TEAM_ID?: string
  CODA_APPLE_APP_PASSWORD?: string
}

export interface NotarizeOptions {
  bundlePath: string
  dryRun?: boolean
  env?: NotarizeEnv
  vars: NotarizeVars
  /** Explicit override for tests — skip real xcrun. */
  xcrunCommand?: string
}

export interface NotarizeEnv {
  fileExists(path: string): boolean
  runCommand(command: string, args: string[]): { exitCode: number; stdout: string; stderr: string }
}

export type NotarizeOutcome =
  | { kind: "dry-run"; missing: string[]; bundleExists: boolean }
  | { kind: "submitted"; submissionId: string; status: NotarizeStatus; stapled: boolean }
  | { kind: "rejected"; submissionId: string | null; reason: string }

export type NotarizeStatus = "Accepted" | "Invalid" | "In Progress" | "Unknown"

export class NotarizeError extends Error {
  constructor(
    message: string,
    public readonly code: "missing-env" | "missing-bundle" | "submit-failed" | "staple-failed",
  ) {
    super(message)
    this.name = "NotarizeError"
  }
}

const REQUIRED_VARS = ["CODA_APPLE_ID", "CODA_APPLE_TEAM_ID", "CODA_APPLE_APP_PASSWORD"] as const

export function missingVars(vars: NotarizeVars): string[] {
  return REQUIRED_VARS.filter((k) => !vars[k as keyof NotarizeVars])
}

export function notarize(opts: NotarizeOptions): NotarizeOutcome {
  const env = opts.env ?? defaultEnv()
  const xcrun = opts.xcrunCommand ?? "xcrun"
  const missing = missingVars(opts.vars)
  const bundleExists = env.fileExists(opts.bundlePath)

  if (opts.dryRun) {
    return { kind: "dry-run", missing, bundleExists }
  }

  if (missing.length > 0) {
    throw new NotarizeError(`missing env vars: ${missing.join(", ")}`, "missing-env")
  }
  if (!bundleExists) {
    throw new NotarizeError(`bundle not found: ${opts.bundlePath}`, "missing-bundle")
  }

  const submission = env.runCommand(xcrun, [
    "notarytool",
    "submit",
    opts.bundlePath,
    "--apple-id",
    opts.vars.CODA_APPLE_ID as string,
    "--team-id",
    opts.vars.CODA_APPLE_TEAM_ID as string,
    "--password",
    opts.vars.CODA_APPLE_APP_PASSWORD as string,
    "--output-format",
    "json",
    "--wait",
  ])

  if (submission.exitCode !== 0) {
    const id = parseSubmissionId(submission.stdout) ?? parseSubmissionId(submission.stderr)
    return {
      kind: "rejected",
      submissionId: id,
      reason: submission.stderr.trim() || submission.stdout.trim() || `exit ${submission.exitCode}`,
    }
  }

  const parsed = parseNotarytoolOutput(submission.stdout)

  if (parsed.status !== "Accepted") {
    return {
      kind: "rejected",
      submissionId: parsed.id,
      reason: `notarytool status: ${parsed.status}`,
    }
  }

  const staple = env.runCommand(xcrun, ["stapler", "staple", opts.bundlePath])
  if (staple.exitCode !== 0) {
    throw new NotarizeError(
      `stapler staple failed: ${staple.stderr.trim() || staple.stdout.trim()}`,
      "staple-failed",
    )
  }

  return {
    kind: "submitted",
    submissionId: parsed.id ?? "",
    status: parsed.status,
    stapled: true,
  }
}

/** Parse `xcrun notarytool submit --output-format json` output. */
export function parseNotarytoolOutput(out: string): { id: string | null; status: NotarizeStatus } {
  const trimmed = out.trim()
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { id?: string; status?: string }
      return {
        id: parsed.id ?? null,
        status: normalizeStatus(parsed.status),
      }
    } catch {
      // fall through
    }
  }
  // Fallback: notarytool in older Xcode versions prints plaintext.
  const id = parseSubmissionId(trimmed)
  const status = /status:\s*Accepted/i.test(trimmed)
    ? "Accepted"
    : /status:\s*Invalid/i.test(trimmed)
      ? "Invalid"
      : /status:\s*In Progress/i.test(trimmed)
        ? "In Progress"
        : "Unknown"
  return { id, status }
}

export function parseSubmissionId(output: string): string | null {
  const m = output.match(/id:\s*([a-fA-F0-9-]{8,})/)
  return m ? m[1] : null
}

function normalizeStatus(s?: string): NotarizeStatus {
  if (!s) return "Unknown"
  const key = s.trim().toLowerCase()
  if (key === "accepted") return "Accepted"
  if (key === "invalid") return "Invalid"
  if (key === "in progress") return "In Progress"
  return "Unknown"
}

function defaultEnv(): NotarizeEnv {
  const fs = req<typeof import("node:fs")>("node:fs")
  const child = req<typeof import("node:child_process")>("node:child_process")
  return {
    fileExists(p) {
      try {
        const s = fs.statSync(p)
        return s.isFile() || s.isDirectory()
      } catch {
        return false
      }
    },
    runCommand(command, args) {
      const r = child.spawnSync(command, args, { encoding: "utf8" })
      return {
        exitCode: r.status ?? 1,
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? "",
      }
    },
  }
}

function req<T>(name: string): T {
  const r = (globalThis as unknown as { require?: (m: string) => unknown }).require
  if (!r) throw new Error(`node module ${name} not available`)
  return r(name) as T
}

// CLI
if ((import.meta as unknown as { main?: boolean }).main) {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes("--dry-run")
  const bundleIdx = argv.findIndex((a) => a === "--bundle")
  const bundlePath =
    bundleIdx >= 0
      ? argv[bundleIdx + 1]
      : (argv.filter((a) => !a.startsWith("--"))[0] ?? "target/release/bundle/macos/Coda.app.zip")

  try {
    const result = notarize({
      bundlePath,
      dryRun,
      vars: process.env as unknown as NotarizeVars,
    })
    if (result.kind === "rejected") {
      console.error(`notarization rejected: ${result.reason}`)
      process.exit(2)
    }
    if (result.kind === "dry-run") {
      console.log(
        `dry-run: bundleExists=${result.bundleExists} missing=[${result.missing.join(", ")}]`,
      )
      process.exit(result.missing.length === 0 && result.bundleExists ? 0 : 1)
    }
    console.log(`notarized: id=${result.submissionId} stapled=${result.stapled}`)
  } catch (err) {
    if (err instanceof NotarizeError) {
      console.error(`${err.code}: ${err.message}`)
      process.exit(3)
    }
    throw err
  }
}
