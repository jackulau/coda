import { describe, expect, test } from "bun:test"
import {
  allServers,
  getServer,
  isInstalled,
  resolveForFile,
} from "./registry"

describe("LSP registry", () => {
  test("has 22 entries covering required languages", () => {
    const list = allServers()
    expect(list.length).toBeGreaterThanOrEqual(22)
    const ids = new Set(list.map((e) => e.id))
    const required = [
      "typescript", "javascript", "python", "rust", "go", "java",
      "c", "cpp", "csharp", "ruby", "php", "swift", "kotlin", "scala",
      "lua", "bash", "html", "css", "json", "yaml", "markdown", "sql",
    ]
    for (const lang of required) {
      expect(ids.has(lang)).toBe(true)
    }
  })

  test("every entry has a document selector with scheme: file", () => {
    for (const e of allServers()) {
      expect(e.documentSelector.length).toBeGreaterThan(0)
      for (const sel of e.documentSelector) {
        expect(sel.scheme).toBe("file")
        expect(typeof sel.language).toBe("string")
      }
    }
  })

  test("every entry has an install hint", () => {
    for (const e of allServers()) {
      expect(e.installHint.length).toBeGreaterThan(0)
    }
  })

  test("getServer returns by id or null", () => {
    expect(getServer("rust")?.name).toBe("Rust")
    expect(getServer("nonexistent")).toBeNull()
  })

  test("resolveForFile maps common extensions", () => {
    expect(resolveForFile("app/src/index.ts")?.id).toBe("typescript")
    expect(resolveForFile("main.rs")?.id).toBe("rust")
    expect(resolveForFile("pkg/main.go")?.id).toBe("go")
    expect(resolveForFile("config.yml")?.id).toBe("yaml")
    expect(resolveForFile("hello.py")?.id).toBe("python")
    expect(resolveForFile("README.md")?.id).toBe("markdown")
    expect(resolveForFile("index.html")?.id).toBe("html")
  })

  test("resolveForFile is case-insensitive on extensions", () => {
    expect(resolveForFile("main.RS")?.id).toBe("rust")
    expect(resolveForFile("INDEX.HTML")?.id).toBe("html")
  })

  test("resolveForFile returns null for unknown extensions", () => {
    expect(resolveForFile("something.xyz")).toBeNull()
    expect(resolveForFile("noextension")).toBeNull()
  })

  test("isInstalled consults both PATH and bundled dir", () => {
    let pathChecks: string[] = []
    let dirChecks: Array<{ dir: string; cmd: string }> = []
    const probe = {
      existsOnPath: (cmd: string) => {
        pathChecks.push(cmd)
        return cmd === "rust-analyzer"
      },
      existsInDir: (dir: string, cmd: string) => {
        dirChecks.push({ dir, cmd })
        return dir === "/bundle" && cmd === "gopls"
      },
    }
    expect(isInstalled("rust", probe)).toBe(true) // on PATH
    expect(pathChecks).toContain("rust-analyzer")

    pathChecks = []
    dirChecks = []
    expect(isInstalled("go", probe, "/bundle")).toBe(true) // in bundle
    expect(dirChecks[0]).toEqual({ dir: "/bundle", cmd: "gopls" })

    pathChecks = []
    dirChecks = []
    expect(isInstalled("python", probe, "/bundle")).toBe(false) // neither
    expect(isInstalled("nonexistent", probe)).toBe(false)
  })

  test("does not double-claim the `.js` extension for javascript vs typescript", () => {
    // Both ts and js entries claim .js — first-registration wins.
    // typescript entry comes first and claims all JS extensions.
    const first = resolveForFile("a.js")
    expect(first).not.toBeNull()
    expect(first?.serverCommand).toBe("typescript-language-server")
  })
})
