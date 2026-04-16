import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, resolve } from "node:path"

const repoRoot = resolve(import.meta.dir, "../../../../..")
const packages = ["core", "app", "ui"] as const

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) yield* walk(full)
    else if (/\.(ts|tsx)$/.test(entry)) yield full
  }
}

const BARE_AWAIT = /\bawait\s+(fetch|spawn|exec|conn\.query|db\.query|client\.query)\b/

describe("require-timeout audit", () => {
  test("no bare `await fetch/spawn/exec/conn.query` outside tests", () => {
    const violations: { file: string; line: number; match: string }[] = []
    for (const pkg of packages) {
      const pkgRoot = join(repoRoot, "packages", pkg, "src")
      try {
        for (const file of walk(pkgRoot)) {
          if (/\.(test|vitest|spec)\.(ts|tsx)$/.test(file)) continue
          const text = readFileSync(file, "utf8")
          const lines = text.split("\n")
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? ""
            if (BARE_AWAIT.test(line) && !/withTimeout/.test(line)) {
              violations.push({ file, line: i + 1, match: line.trim() })
            }
          }
        }
      } catch {}
    }
    if (violations.length > 0) {
      const msg = violations.map((v) => `${v.file}:${v.line}  ${v.match}`).join("\n")
      throw new Error(`bare awaits found — wrap with withTimeout(...):\n${msg}`)
    }
    expect(violations.length).toBe(0)
  })
})
