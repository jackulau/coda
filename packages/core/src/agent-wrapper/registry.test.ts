import { describe, expect, test } from "bun:test"
import { DEFAULT_AGENTS, planSpawn, sanitizeEnv } from "./registry"

describe("planSpawn", () => {
  test("claude-code basic command", () => {
    const p = planSpawn({ kind: "claude-code", cwd: "/ws" })
    expect(p.command).toBe("claude")
    expect(p.args).toEqual(["--effort", "max"])
  })

  test("codex resume uses --session", () => {
    const p = planSpawn({ kind: "codex", sessionId: "sess_9", cwd: "/ws" })
    expect(p.args).toEqual(["--session", "sess_9"])
  })

  test("claude-code resume uses --resume", () => {
    const p = planSpawn({ kind: "claude-code", sessionId: "sess_1", cwd: "/ws" })
    expect(p.args).toEqual(["--effort", "max", "--resume", "sess_1"])
  })

  test("copilot chat has startup args", () => {
    const p = planSpawn({ kind: "copilot", cwd: "/ws" })
    expect(p.command).toBe("gh")
    expect(p.args).toEqual(["copilot", "chat"])
  })

  test("extraArgs appended at the end", () => {
    const p = planSpawn({ kind: "claude-code", extraArgs: ["--trace"], cwd: "/ws" })
    expect(p.args).toEqual(["--effort", "max", "--trace"])
  })

  test("unknown kind throws", () => {
    expect(() => planSpawn({ kind: "unknown" as never, cwd: "/ws" })).toThrow()
  })
})

describe("sanitizeEnv", () => {
  test("strips ANTHROPIC_API_KEY, GITHUB_TOKEN, etc.", () => {
    const out = sanitizeEnv(
      {
        PATH: "/usr/bin",
        HOME: "/home/x",
        ANTHROPIC_API_KEY: "sk-...",
        GITHUB_TOKEN: "ghp_...",
        GH_TOKEN: "ghu_...",
        OPENAI_API_KEY: "sk-openai-...",
        AWS_ACCESS_KEY_ID: "AKIA",
        AWS_SECRET_ACCESS_KEY: "sec",
        AWS_SESSION_TOKEN: "tok",
        CODA_SIDECAR_SECRET: "hmac",
      },
      DEFAULT_AGENTS["claude-code"],
    )
    expect(out.PATH).toBe("/usr/bin")
    expect(out.HOME).toBe("/home/x")
    expect(out.ANTHROPIC_API_KEY).toBeUndefined()
    expect(out.GITHUB_TOKEN).toBeUndefined()
    expect(out.AWS_ACCESS_KEY_ID).toBeUndefined()
    expect(out.CODA_SIDECAR_SECRET).toBeUndefined()
  })

  test("preserves allowed CODA_* env", () => {
    const out = sanitizeEnv(
      { CODA_SIDECAR_SECRET: "k", ANTHROPIC_BASE_URL: "https://x" },
      DEFAULT_AGENTS["claude-code"],
    )
    expect(out.ANTHROPIC_BASE_URL).toBe("https://x")
  })

  test("strips unknown CODA_* env", () => {
    const out = sanitizeEnv({ CODA_RANDOM: "x" }, DEFAULT_AGENTS.amp)
    expect(out.CODA_RANDOM).toBeUndefined()
  })
})
