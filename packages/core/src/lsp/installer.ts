// LSP server installer.
//
// Installs/uninstalls a language server per `registry.ts` entry. Design goals:
//   1. Pure logic — network + subprocess + filesystem are injectable so tests
//      can exercise the state machine without mocking real tools.
//   2. Atomic — downloads land in a temp directory, SHA256 is verified, then
//      the whole tree is renamed into `~/.coda/lsp/<id>/`.
//   3. Multi-strategy — some servers ship native binaries, some install via
//      `npm i -g`, some via `cargo install`. The registry entry picks.
//
// The public entry point is `installServer(id, opts)`. Callers normally only
// override the defaults for testing.

import { allServers, type LspRegistryEntry } from "./registry"

export type InstallPhase =
  | "resolving"
  | "downloading"
  | "verifying"
  | "extracting"
  | "running-package-manager"
  | "finalizing"
  | "done"

export interface InstallProgress {
  phase: InstallPhase
  bytesReceived?: number
  bytesTotal?: number
  detail?: string
}

export interface InstallOptions {
  force?: boolean
  onProgress?: (p: InstallProgress) => void
  /** Root override for `~/.coda/lsp`. */
  installRoot?: string
  /** DI for tests — defaults use real node builtins. */
  env?: InstallEnv
  /** Platform override for testing cross-OS code paths. */
  platform?: "darwin-x64" | "darwin-arm64" | "linux-x64" | "linux-arm64" | "win32-x64"
}

export interface InstallResult {
  id: string
  installedTo: string
  strategy: "download" | "npm" | "cargo" | "skipped"
  bytesDownloaded: number
}

export interface UninstallResult {
  id: string
  removed: boolean
}

/**
 * Seam for all side effects. Real impl uses `node:fs`, `node:https`, and
 * `child_process.spawnSync`; tests supply simulated versions.
 */
export interface InstallEnv {
  fileExists(path: string): boolean
  directoryExists(path: string): boolean
  makeTempDir(prefix: string): string
  makeDir(path: string): void
  writeFile(path: string, data: Uint8Array): void
  removeDirRecursive(path: string): void
  rename(from: string, to: string): void
  homeDir(): string
  /** Download a URL to a byte array. Progress may be reported via `onChunk`. */
  download(url: string, onChunk?: (received: number, total?: number) => void): Promise<Uint8Array>
  /** SHA256 hex of a buffer. */
  sha256(data: Uint8Array): string
  /** Run a child process synchronously. Return {exitCode, stdout, stderr}. */
  runCommand(
    command: string,
    args: string[],
    env?: Record<string, string>,
  ): { exitCode: number; stdout: string; stderr: string }
}

export class InstallError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "unknown-server"
      | "checksum-mismatch"
      | "download-failed"
      | "package-manager-failed"
      | "no-strategy"
      | "platform-unsupported",
  ) {
    super(message)
    this.name = "InstallError"
  }
}

export async function installServer(
  id: string,
  opts: InstallOptions = {},
  registry: readonly LspRegistryEntry[] = allServers(),
): Promise<InstallResult> {
  const entry = registry.find((e) => e.id === id)
  if (!entry) throw new InstallError(`unknown server id: ${id}`, "unknown-server")

  const env = opts.env ?? defaultEnv()
  const platform = opts.platform ?? detectPlatform(env)
  const installRoot = opts.installRoot ?? defaultInstallRoot(env)
  const targetDir = `${installRoot}/${entry.id}`
  const progress = opts.onProgress ?? (() => {})

  progress({ phase: "resolving" })

  if (!opts.force && env.directoryExists(targetDir)) {
    return {
      id: entry.id,
      installedTo: targetDir,
      strategy: "skipped",
      bytesDownloaded: 0,
    }
  }

  const strategy = chooseStrategy(entry, platform)

  if (strategy === "download") {
    return runDownloadStrategy(entry, platform, targetDir, installRoot, env, progress, opts.force)
  }
  if (strategy === "npm") {
    return runPackageManagerStrategy("npm", entry, targetDir, installRoot, env, progress)
  }
  if (strategy === "cargo") {
    return runPackageManagerStrategy("cargo", entry, targetDir, installRoot, env, progress)
  }
  throw new InstallError(`no install strategy for ${entry.id}`, "no-strategy")
}

export function uninstall(
  id: string,
  opts: { installRoot?: string; env?: InstallEnv } = {},
): UninstallResult {
  const env = opts.env ?? defaultEnv()
  const installRoot = opts.installRoot ?? defaultInstallRoot(env)
  const targetDir = `${installRoot}/${id}`
  if (!env.directoryExists(targetDir)) {
    return { id, removed: false }
  }
  env.removeDirRecursive(targetDir)
  return { id, removed: true }
}

// ---- internals -------------------------------------------------------------

export function chooseStrategy(
  entry: LspRegistryEntry,
  platform: InstallOptions["platform"],
): "download" | "npm" | "cargo" | "none" {
  if (entry.releaseUrls && platform && entry.releaseUrls[platform]) {
    return "download"
  }
  // Heuristic: the registry's installHint tells us which package manager to try.
  // TypeScript-flavored entries recommend npm, rust entries recommend cargo.
  const hint = entry.installHint.toLowerCase()
  if (hint.includes("npm install") || hint.includes("npm i")) return "npm"
  if (hint.includes("cargo install")) return "cargo"
  return "none"
}

async function runDownloadStrategy(
  entry: LspRegistryEntry,
  platform: InstallOptions["platform"],
  targetDir: string,
  installRoot: string,
  env: InstallEnv,
  progress: (p: InstallProgress) => void,
  force?: boolean,
): Promise<InstallResult> {
  const url = entry.releaseUrls?.[platform ?? "linux-x64"]
  if (!url) {
    throw new InstallError(
      `no release URL for platform ${platform} in registry entry ${entry.id}`,
      "platform-unsupported",
    )
  }

  progress({ phase: "downloading", bytesReceived: 0 })
  const bytes = await env.download(url, (rcv, total) =>
    progress({ phase: "downloading", bytesReceived: rcv, bytesTotal: total }),
  )
  if (!bytes || bytes.length === 0) {
    throw new InstallError(`empty download for ${entry.id}`, "download-failed")
  }

  if (entry.releaseChecksum) {
    progress({ phase: "verifying" })
    const actual = env.sha256(bytes)
    if (actual.toLowerCase() !== entry.releaseChecksum.toLowerCase()) {
      throw new InstallError(
        `checksum mismatch for ${entry.id}: expected ${entry.releaseChecksum}, got ${actual}`,
        "checksum-mismatch",
      )
    }
  }

  progress({ phase: "extracting" })
  const staging = env.makeTempDir(`coda-lsp-${entry.id}-`)
  // For simplicity, write the payload as a single file under staging and let
  // an external extractor handle archive formats. Most LSP distributions ship
  // as a tarball; the real extractor sits inside the desktop/Tauri layer. In
  // tests we just assert the staging dir structure.
  env.writeFile(`${staging}/${entry.serverCommand}`, bytes)

  progress({ phase: "finalizing" })
  if (force && env.directoryExists(targetDir)) {
    env.removeDirRecursive(targetDir)
  }
  env.makeDir(installRoot)
  env.rename(staging, targetDir)

  progress({ phase: "done" })
  return {
    id: entry.id,
    installedTo: targetDir,
    strategy: "download",
    bytesDownloaded: bytes.length,
  }
}

function runPackageManagerStrategy(
  pm: "npm" | "cargo",
  entry: LspRegistryEntry,
  targetDir: string,
  installRoot: string,
  env: InstallEnv,
  progress: (p: InstallProgress) => void,
): InstallResult {
  progress({ phase: "running-package-manager", detail: pm })

  const { command, args } = buildPackageManagerCommand(pm, entry)
  const result = env.runCommand(command, args, {
    ...(pm === "npm" ? { npm_config_prefix: targetDir } : {}),
    ...(pm === "cargo" ? { CARGO_INSTALL_ROOT: targetDir } : {}),
  })
  if (result.exitCode !== 0) {
    throw new InstallError(
      `${pm} install failed for ${entry.id}: exit ${result.exitCode}\n${result.stderr}`,
      "package-manager-failed",
    )
  }

  progress({ phase: "finalizing" })
  if (!env.directoryExists(targetDir)) {
    env.makeDir(targetDir)
  }
  env.makeDir(installRoot)

  progress({ phase: "done" })
  return {
    id: entry.id,
    installedTo: targetDir,
    strategy: pm,
    bytesDownloaded: 0,
  }
}

export function buildPackageManagerCommand(
  pm: "npm" | "cargo",
  entry: LspRegistryEntry,
): { command: string; args: string[] } {
  if (pm === "npm") {
    const pkg = entry.installHint.match(/npm\s+i(?:nstall)?\s+-g\s+([^\s]+)/)?.[1] ?? entry.id
    return { command: "npm", args: ["install", "-g", pkg] }
  }
  const crate =
    entry.installHint.match(/cargo\s+install\s+([a-zA-Z0-9_-]+)/)?.[1] ?? entry.serverCommand
  return { command: "cargo", args: ["install", crate] }
}

export function detectPlatform(env: InstallEnv): InstallOptions["platform"] {
  // We do runtime detection on the real env; tests override via opts.platform.
  // The fallback is `linux-x64` which is widely supported.
  const e = env as unknown as { platform?: InstallOptions["platform"] }
  return e.platform ?? (inferNodePlatform() as InstallOptions["platform"])
}

function inferNodePlatform(): string {
  const p = typeof process !== "undefined" ? process.platform : "linux"
  const a = typeof process !== "undefined" ? process.arch : "x64"
  if (p === "darwin") return a === "arm64" ? "darwin-arm64" : "darwin-x64"
  if (p === "linux") return a === "arm64" ? "linux-arm64" : "linux-x64"
  if (p === "win32") return "win32-x64"
  return "linux-x64"
}

export function defaultInstallRoot(env: InstallEnv): string {
  return `${env.homeDir()}/.coda/lsp`
}

function defaultEnv(): InstallEnv {
  // The real environment adapter uses node:fs + node:https + crypto.
  // We keep it lazily-imported so the module can still be imported in browser
  // tests that stub `env` without pulling node builtins.
  const fs = req("node:fs") as typeof import("node:fs")
  const path = req("node:path") as typeof import("node:path")
  const os = req("node:os") as typeof import("node:os")
  const crypto = req("node:crypto") as typeof import("node:crypto")
  const https = req("node:https") as typeof import("node:https")
  const child = req("node:child_process") as typeof import("node:child_process")

  return {
    fileExists(p) {
      try {
        return fs.statSync(p).isFile()
      } catch {
        return false
      }
    },
    directoryExists(p) {
      try {
        return fs.statSync(p).isDirectory()
      } catch {
        return false
      }
    },
    makeTempDir(prefix) {
      return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
    },
    makeDir(p) {
      fs.mkdirSync(p, { recursive: true })
    },
    writeFile(p, data) {
      fs.writeFileSync(p, data)
    },
    removeDirRecursive(p) {
      fs.rmSync(p, { recursive: true, force: true })
    },
    rename(from, to) {
      fs.renameSync(from, to)
    },
    homeDir() {
      return os.homedir()
    },
    download(url, onChunk) {
      return new Promise((resolve, reject) => {
        https
          .get(url, (res) => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}`))
              return
            }
            const chunks: Uint8Array[] = []
            let received = 0
            const total = Number(res.headers["content-length"]) || undefined
            res.on("data", (c: Uint8Array) => {
              chunks.push(c)
              received += c.length
              onChunk?.(received, total)
            })
            res.on("end", () => resolve(concat(chunks)))
            res.on("error", reject)
          })
          .on("error", reject)
      })
    },
    sha256(data) {
      return crypto.createHash("sha256").update(data).digest("hex")
    },
    runCommand(command, args, extraEnv) {
      const r = child.spawnSync(command, args, {
        env: { ...process.env, ...extraEnv },
        encoding: "utf8",
      })
      return {
        exitCode: r.status ?? 1,
        stdout: r.stdout ?? "",
        stderr: r.stderr ?? "",
      }
    },
  }
}

function req<T>(name: string): T {
  // Indirect require so bundlers don't attempt to resolve node builtins in the
  // browser bundle. Callers that pass `opts.env` never hit this.
  const r = (
    globalThis as unknown as { require?: (m: string) => unknown }
  ).require ?? (() => {
    throw new Error(`node module ${name} not available in this runtime`)
  })
  return r(name) as T
}

function concat(chunks: Uint8Array[]): Uint8Array {
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    out.set(c, off)
    off += c.length
  }
  return out
}
