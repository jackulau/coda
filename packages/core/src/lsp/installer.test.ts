// R6: LSP installer tests.
//
// The installer has three strategies — download+verify, `npm i -g`, `cargo install` —
// and we exercise each against a fake environment that records every call.

import { describe, expect, test } from "bun:test"

import {
  buildPackageManagerCommand,
  chooseStrategy,
  defaultInstallRoot,
  InstallError,
  type InstallEnv,
  type InstallOptions,
  installServer,
  uninstall,
} from "./installer"
import type { LspRegistryEntry } from "./registry"

// ---- fake environment ------------------------------------------------------

interface FakeEnv extends InstallEnv {
  home: string
  fsFiles: Map<string, Uint8Array>
  fsDirs: Set<string>
  downloads: Array<{ url: string; bytes: Uint8Array }>
  commands: Array<{ command: string; args: string[]; extraEnv?: Record<string, string> }>
  tempCounter: number
  downloadImpl: (url: string) => Uint8Array
  runCommandImpl: (command: string, args: string[]) => { exitCode: number; stdout: string; stderr: string }
}

function makeEnv(opts: {
  home?: string
  existingDirs?: string[]
  downloadImpl?: FakeEnv["downloadImpl"]
  runCommandImpl?: FakeEnv["runCommandImpl"]
} = {}): FakeEnv {
  const env: FakeEnv = {
    home: opts.home ?? "/home/test",
    fsFiles: new Map(),
    fsDirs: new Set(opts.existingDirs ?? []),
    downloads: [],
    commands: [],
    tempCounter: 0,
    downloadImpl:
      opts.downloadImpl ??
      ((_url) => {
        return new Uint8Array([0xef, 0xbb, 0xbf]) // a few bytes of "data"
      }),
    runCommandImpl: opts.runCommandImpl ?? (() => ({ exitCode: 0, stdout: "", stderr: "" })),
    fileExists(p) {
      return env.fsFiles.has(p)
    },
    directoryExists(p) {
      return env.fsDirs.has(p)
    },
    makeTempDir(prefix) {
      env.tempCounter += 1
      const p = `/tmp/${prefix}${env.tempCounter}`
      env.fsDirs.add(p)
      return p
    },
    makeDir(p) {
      env.fsDirs.add(p)
    },
    writeFile(p, data) {
      env.fsFiles.set(p, data)
    },
    removeDirRecursive(p) {
      env.fsDirs.delete(p)
      for (const k of Array.from(env.fsFiles.keys())) {
        if (k.startsWith(`${p}/`) || k === p) env.fsFiles.delete(k)
      }
    },
    rename(from, to) {
      if (env.fsDirs.has(from)) {
        env.fsDirs.delete(from)
        env.fsDirs.add(to)
      }
      for (const k of Array.from(env.fsFiles.keys())) {
        if (k.startsWith(`${from}/`)) {
          const rest = k.slice(from.length)
          env.fsFiles.set(`${to}${rest}`, env.fsFiles.get(k) as Uint8Array)
          env.fsFiles.delete(k)
        }
      }
    },
    homeDir() {
      return env.home
    },
    async download(url, onChunk) {
      const bytes = env.downloadImpl(url)
      env.downloads.push({ url, bytes })
      onChunk?.(bytes.length, bytes.length)
      return bytes
    },
    sha256(data) {
      // Simple deterministic hash for tests (not cryptographically secure).
      let h = 0xcbf29ce484222325n
      for (const b of data) {
        h = (h ^ BigInt(b)) * 0x100000001b3n
        h &= 0xffffffffffffffffn
      }
      return h.toString(16).padStart(16, "0").padEnd(64, "0")
    },
    runCommand(command, args, extraEnv) {
      env.commands.push({ command, args, extraEnv })
      return env.runCommandImpl(command, args)
    },
  }
  return env
}

// ---- fixtures --------------------------------------------------------------

const RUST_ENTRY: LspRegistryEntry = {
  id: "rust",
  name: "Rust",
  fileExtensions: ["rs"],
  serverCommand: "rust-analyzer",
  serverArgs: [],
  installHint: "cargo install rust-analyzer",
  documentSelector: [{ scheme: "file", language: "rust" }],
  releaseUrls: {
    "linux-x64": "https://example.com/rust-analyzer-linux",
    "darwin-arm64": "https://example.com/rust-analyzer-arm64",
  },
  releaseChecksum: "", // filled in per-test
}

const TS_ENTRY: LspRegistryEntry = {
  id: "typescript",
  name: "TypeScript",
  fileExtensions: ["ts"],
  serverCommand: "typescript-language-server",
  serverArgs: ["--stdio"],
  installHint: "npm i -g typescript-language-server typescript",
  documentSelector: [{ scheme: "file", language: "typescript" }],
}

const GO_ENTRY: LspRegistryEntry = {
  id: "go",
  name: "Go",
  fileExtensions: ["go"],
  serverCommand: "gopls",
  serverArgs: [],
  installHint: "go install golang.org/x/tools/gopls@latest",
  documentSelector: [{ scheme: "file", language: "go" }],
}

// ---- tests -----------------------------------------------------------------

describe("installServer — strategy selection", () => {
  test("chooseStrategy prefers download when releaseUrls is present", () => {
    expect(chooseStrategy(RUST_ENTRY, "linux-x64")).toBe("download")
  })

  test("chooseStrategy falls back to npm when hint says 'npm i -g'", () => {
    expect(chooseStrategy(TS_ENTRY, "linux-x64")).toBe("npm")
  })

  test("chooseStrategy falls back to cargo when hint says 'cargo install'", () => {
    const e = { ...RUST_ENTRY, releaseUrls: undefined }
    expect(chooseStrategy(e, "linux-x64")).toBe("cargo")
  })

  test("chooseStrategy returns 'none' when no strategy matches", () => {
    expect(chooseStrategy(GO_ENTRY, "linux-x64")).toBe("none")
  })

  test("buildPackageManagerCommand npm extracts package name from hint", () => {
    expect(buildPackageManagerCommand("npm", TS_ENTRY)).toEqual({
      command: "npm",
      args: ["install", "-g", "typescript-language-server"],
    })
  })

  test("buildPackageManagerCommand cargo extracts crate name from hint", () => {
    const e = { ...RUST_ENTRY, releaseUrls: undefined }
    expect(buildPackageManagerCommand("cargo", e)).toEqual({
      command: "cargo",
      args: ["install", "rust-analyzer"],
    })
  })
})

describe("installServer — download strategy", () => {
  test("downloads, verifies checksum, and finalizes atomically", async () => {
    const env = makeEnv()
    const payload = new Uint8Array([1, 2, 3, 4, 5])
    env.downloadImpl = () => payload
    const expected = env.sha256(payload)
    const entry = { ...RUST_ENTRY, releaseChecksum: expected }

    const phases = new Set<string>()
    const result = await installServer(
      "rust",
      {
        env,
        platform: "linux-x64",
        installRoot: "/root/.coda/lsp",
        onProgress: (p) => phases.add(p.phase),
      },
      [entry],
    )

    expect(result.strategy).toBe("download")
    expect(result.installedTo).toBe("/root/.coda/lsp/rust")
    expect(result.bytesDownloaded).toBe(payload.length)
    for (const expected of [
      "resolving",
      "downloading",
      "verifying",
      "extracting",
      "finalizing",
      "done",
    ]) {
      expect(phases.has(expected)).toBe(true)
    }
    expect(env.downloads[0]?.url).toBe("https://example.com/rust-analyzer-linux")
    expect(env.fsDirs.has("/root/.coda/lsp/rust")).toBe(true)
    // Staging dir was renamed away.
    expect(env.fsDirs.has("/tmp/coda-lsp-rust-1")).toBe(false)
  })

  test("aborts when checksum mismatches", async () => {
    const env = makeEnv()
    env.downloadImpl = () => new Uint8Array([9, 9, 9])
    const entry = {
      ...RUST_ENTRY,
      releaseChecksum: "wrong",
    }
    await expect(
      installServer("rust", { env, platform: "linux-x64", installRoot: "/r" }, [entry]),
    ).rejects.toThrow(InstallError)
  })

  test("aborts on zero-byte download", async () => {
    const env = makeEnv()
    env.downloadImpl = () => new Uint8Array(0)
    await expect(
      installServer(
        "rust",
        { env, platform: "linux-x64", installRoot: "/r" },
        [{ ...RUST_ENTRY, releaseChecksum: "" }],
      ),
    ).rejects.toThrow(/empty download/)
  })

  test("falls back to package manager when platform has no release url", async () => {
    const env = makeEnv()
    // Entry has releaseUrls for linux/darwin but not win32; we also have a
    // cargo-flavored installHint so the installer falls back to cargo.
    const result = await installServer(
      "rust",
      { env, platform: "win32-x64", installRoot: "/r" },
      [{ ...RUST_ENTRY, releaseChecksum: "" }],
    )
    expect(result.strategy).toBe("cargo")
  })

  test("aborts when download explicitly selected but url missing", async () => {
    // If an entry advertises only one platform and we ask for another AND
    // no fallback strategy is available, the installer surfaces no-strategy.
    const env = makeEnv()
    const entryLinuxOnly = {
      ...RUST_ENTRY,
      installHint: "manual",
      releaseUrls: { "linux-x64": "https://example.com/x" },
      releaseChecksum: "",
    }
    await expect(
      installServer(
        "rust",
        { env, platform: "win32-x64", installRoot: "/r" },
        [entryLinuxOnly],
      ),
    ).rejects.toThrow(/no install strategy/)
  })

  test("skips if already installed and force is false", async () => {
    const env = makeEnv({ existingDirs: ["/root/.coda/lsp/rust"] })
    const result = await installServer(
      "rust",
      { env, platform: "linux-x64", installRoot: "/root/.coda/lsp" },
      [{ ...RUST_ENTRY, releaseChecksum: "" }],
    )
    expect(result.strategy).toBe("skipped")
    expect(env.downloads).toHaveLength(0)
  })

  test("re-installs when force is true", async () => {
    const env = makeEnv({ existingDirs: ["/root/.coda/lsp/rust"] })
    const payload = new Uint8Array([7, 7, 7])
    env.downloadImpl = () => payload
    const result = await installServer(
      "rust",
      { env, platform: "linux-x64", installRoot: "/root/.coda/lsp", force: true },
      [{ ...RUST_ENTRY, releaseChecksum: "" }],
    )
    expect(result.strategy).toBe("download")
    expect(env.downloads).toHaveLength(1)
  })

  test("reports download progress via onProgress", async () => {
    const env = makeEnv()
    const payload = new Uint8Array([1, 2, 3])
    env.downloadImpl = () => payload
    const progresses: number[] = []
    await installServer(
      "rust",
      {
        env,
        platform: "linux-x64",
        installRoot: "/r",
        onProgress: (p) => {
          if (p.phase === "downloading" && p.bytesReceived !== undefined) {
            progresses.push(p.bytesReceived)
          }
        },
      },
      [{ ...RUST_ENTRY, releaseChecksum: "" }],
    )
    expect(progresses).toContain(0)
    expect(progresses).toContain(payload.length)
  })
})

describe("installServer — package manager strategies", () => {
  test("npm strategy runs npm install -g with target prefix env", async () => {
    const env = makeEnv()
    const result = await installServer(
      "typescript",
      { env, platform: "linux-x64", installRoot: "/r" },
      [TS_ENTRY],
    )
    expect(result.strategy).toBe("npm")
    const cmd = env.commands[0]
    if (!cmd) throw new Error("no command recorded")
    expect(cmd.command).toBe("npm")
    expect(cmd.args).toEqual(["install", "-g", "typescript-language-server"])
    expect(cmd.extraEnv?.npm_config_prefix).toBe("/r/typescript")
  })

  test("cargo strategy runs cargo install with CARGO_INSTALL_ROOT", async () => {
    const env = makeEnv()
    const entry = { ...RUST_ENTRY, releaseUrls: undefined }
    const result = await installServer(
      "rust",
      { env, platform: "linux-x64", installRoot: "/r" },
      [entry],
    )
    expect(result.strategy).toBe("cargo")
    expect(env.commands[0]).toEqual({
      command: "cargo",
      args: ["install", "rust-analyzer"],
      extraEnv: { CARGO_INSTALL_ROOT: "/r/rust" },
    })
  })

  test("npm strategy surfaces exit code as InstallError", async () => {
    const env = makeEnv({
      runCommandImpl: () => ({ exitCode: 1, stdout: "", stderr: "EACCES" }),
    })
    await expect(
      installServer("typescript", { env, installRoot: "/r" }, [TS_ENTRY]),
    ).rejects.toThrow(/npm install failed/)
  })
})

describe("installServer — validation", () => {
  test("unknown server id throws", async () => {
    await expect(installServer("bogus", {}, [])).rejects.toThrow(/unknown server/)
  })

  test("no strategy available throws 'no-strategy'", async () => {
    const env = makeEnv()
    await expect(
      installServer("go", { env, installRoot: "/r" }, [GO_ENTRY]),
    ).rejects.toThrow(/no install strategy/)
  })
})

describe("uninstall", () => {
  test("removes the target directory if present", () => {
    const env = makeEnv({ existingDirs: ["/root/.coda/lsp/typescript"] })
    const r = uninstall("typescript", { env, installRoot: "/root/.coda/lsp" })
    expect(r.removed).toBe(true)
    expect(env.fsDirs.has("/root/.coda/lsp/typescript")).toBe(false)
  })

  test("returns removed=false when directory does not exist", () => {
    const env = makeEnv()
    const r = uninstall("typescript", { env, installRoot: "/root/.coda/lsp" })
    expect(r.removed).toBe(false)
  })
})

describe("defaults", () => {
  test("defaultInstallRoot uses ~/.coda/lsp", () => {
    const env = makeEnv({ home: "/users/alice" })
    expect(defaultInstallRoot(env)).toBe("/users/alice/.coda/lsp")
  })
})
