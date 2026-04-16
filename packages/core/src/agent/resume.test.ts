import { describe, expect, test } from "bun:test"
import { buildResume, parseAgentOutput } from "./resume"

describe("buildResume", () => {
  test("claude-code with --resume + session id", () => {
    const out = buildResume({
      vendor: "claude-code",
      sessionId: "abc-123",
      cwd: "/tmp",
      continueFromLastTurn: true,
    })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.command.argv).toEqual(["claude", "--resume", "abc-123"])
    }
  })

  test("claude-code --continue when continueFromLastTurn is false", () => {
    const out = buildResume({
      vendor: "claude-code",
      sessionId: "xyz",
      cwd: "/",
      continueFromLastTurn: false,
    })
    if (out.ok) {
      expect(out.command.argv[1]).toBe("--continue")
    }
  })

  test("claude-code appends --model when set", () => {
    const out = buildResume({
      vendor: "claude-code",
      sessionId: "s",
      cwd: "/",
      continueFromLastTurn: true,
      model: "claude-opus-4-6",
    })
    if (out.ok) {
      expect(out.command.argv).toContain("claude-opus-4-6")
    }
  })

  test("codex / copilot / gemini / amp produce vendor-specific argv", () => {
    const vendors = ["codex", "copilot", "gemini", "amp"] as const
    for (const v of vendors) {
      const out = buildResume({
        vendor: v,
        sessionId: "s",
        cwd: "/",
        continueFromLastTurn: true,
      })
      expect(out.ok).toBe(true)
      if (out.ok) expect(out.command.argv[0]).toBeDefined()
    }
  })

  test("empty sessionId → missing-session", () => {
    const out = buildResume({
      vendor: "claude-code",
      sessionId: "",
      cwd: "/",
      continueFromLastTurn: true,
    })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toBe("missing-session")
  })
})

describe("parseAgentOutput", () => {
  test("[status] → status event", () => {
    expect(parseAgentOutput("[status] thinking...", 1)).toEqual({
      type: "status",
      payload: "thinking...",
      ts: 1,
    })
  })
  test("[exit] → exit event", () => {
    expect(parseAgentOutput("[exit] 0", 1).type).toBe("exit")
  })
  test("[err] → stderr event", () => {
    expect(parseAgentOutput("[err] oops", 1).type).toBe("stderr")
  })
  test("plain line → stdout", () => {
    expect(parseAgentOutput("hello", 1).type).toBe("stdout")
  })
})
