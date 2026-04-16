#!/usr/bin/env node
// Runs vitest with ESBUILD_BINARY_PATH forced to the node_modules esbuild
// binary. Works around a Bun 1.3 + Vite 5 interop bug where Bun's built-in
// esbuild (0.27.x) gets spawned instead of vite's pinned esbuild (0.21.x),
// causing "Host version does not match binary version" failures when vite
// loads vite.config.ts.
//
// Runs regardless of whether any test files exist (vitest is called with
// --passWithNoTests elsewhere).

import { spawnSync } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "../../..")

// Bun flattens installs under .bun/@esbuild+${platform}@${version}/...;
// npm/pnpm put it under @esbuild/${platform}. Node on macOS can run under
// x64 (Rosetta) while bun installs an arm64 esbuild — both execute fine
// on the same host, so try every reasonable arch combination.
const archKeys = [`${process.platform}-${process.arch}`]
if (process.platform === "darwin") {
  if (!archKeys.includes("darwin-arm64")) archKeys.push("darwin-arm64")
  if (!archKeys.includes("darwin-x64")) archKeys.push("darwin-x64")
}

const candidates = []
for (const platformKey of archKeys) {
  candidates.push(resolve(repoRoot, `node_modules/@esbuild/${platformKey}/bin/esbuild`))
  const bunStore = resolve(repoRoot, "node_modules/.bun")
  if (existsSync(bunStore)) {
    for (const entry of readdirSync(bunStore)) {
      if (entry.startsWith(`@esbuild+${platformKey}@`)) {
        candidates.push(
          resolve(bunStore, entry, `node_modules/@esbuild/${platformKey}/bin/esbuild`),
        )
      }
    }
  }
}

const binary = candidates.find(existsSync)
if (binary) {
  process.env.ESBUILD_BINARY_PATH = binary
} else {
  const list = candidates.map((c) => `  - ${c}`).join("\n")
  console.warn(
    `[run-vitest] Warning: no esbuild binary found for ${archKeys[0]}; vitest may hit a host/binary version mismatch. Looked in:\n${list}`,
  )
}

const args = ["run", "--passWithNoTests", ...process.argv.slice(2)]
const vitestBin = resolve(repoRoot, "node_modules/.bin/vitest")

let cmd
let cmdArgs

if (existsSync(vitestBin)) {
  cmd = vitestBin
  cmdArgs = args
} else {
  const req = createRequire(import.meta.url)
  try {
    const vitestPkgPath = req.resolve("vitest/package.json", {
      paths: [resolve(__dirname, "..")],
    })
    const vitestDir = dirname(vitestPkgPath)
    const pkg = req(vitestPkgPath)
    const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.vitest
    if (!bin) throw new Error("vitest has no bin entry")
    cmd = "node"
    cmdArgs = [resolve(vitestDir, bin), ...args]
  } catch (err) {
    console.error("[run-vitest] Could not locate vitest:", err.message)
    process.exit(1)
  }
}

const res = spawnSync(cmd, cmdArgs, {
  stdio: "inherit",
  env: process.env,
  cwd: resolve(__dirname, ".."),
})

process.exit(res.status ?? 1)
