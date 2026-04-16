#!/usr/bin/env node
// Wraps vite with ESBUILD_BINARY_PATH forced to the locally-installed
// esbuild binary. Works around the Bun 1.3 + Vite 5 interop where Node
// (running under Rosetta) resolves a different esbuild version than the
// one Vite expects. Same helper shape as run-vitest.mjs.

import { spawnSync } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "../../..")

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
}

const req = createRequire(import.meta.url)
let viteBin
try {
  const vitePkgPath = req.resolve("vite/package.json", { paths: [resolve(__dirname, "..")] })
  const viteDir = dirname(vitePkgPath)
  viteBin = resolve(viteDir, "bin/vite.js")
  if (!existsSync(viteBin)) throw new Error(`vite bin not at ${viteBin}`)
} catch (err) {
  console.error("[run-vite] Could not locate vite:", err.message)
  process.exit(1)
}

const res = spawnSync("node", [viteBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
  cwd: resolve(__dirname, ".."),
})

process.exit(res.status ?? 1)
