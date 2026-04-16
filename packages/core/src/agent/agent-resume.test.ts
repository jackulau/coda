import { describe, expect, test } from "bun:test"
import { buildResume } from "./resume"

describe("agent-resume via Agent layer (not stdin injection)", () => {
  test("claude-code with continueFromLastTurn=true uses --resume", () => {
    const res = buildResume({
      vendor: "claude-code",
      sessionId: "abc",
      cwd: "/tmp",
      continueFromLastTurn: true,
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.command.argv).toContain("--resume")
  })

  test("claude-code with continueFromLastTurn=false uses --continue", () => {
    const res = buildResume({
      vendor: "claude-code",
      sessionId: "abc",
      cwd: "/tmp",
      continueFromLastTurn: false,
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.command.argv).toContain("--continue")
  })

  test("claude-code with model flag passes it", () => {
    const res = buildResume({
      vendor: "claude-code",
      sessionId: "abc",
      cwd: "/tmp",
      continueFromLastTurn: true,
      model: "claude-opus-4-7",
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.command.argv).toContain("--model")
      expect(res.command.argv).toContain("claude-opus-4-7")
    }
  })

  test("codex vendor resumes session", () => {
    const res = buildResume({
      vendor: "codex",
      sessionId: "s1",
      cwd: "/tmp",
      continueFromLastTurn: true,
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.command.argv).toEqual(["codex", "session", "resume", "s1"])
  })

  test("missing sessionId rejected", () => {
    const res = buildResume({
      vendor: "claude-code",
      sessionId: "",
      cwd: "/tmp",
      continueFromLastTurn: true,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.reason).toBe("missing-session")
  })

  test("copilot vendor builds gh copilot chat command", () => {
    const res = buildResume({
      vendor: "copilot",
      sessionId: "s",
      cwd: "/tmp",
      continueFromLastTurn: false,
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.command.argv[0]).toBe("gh")
  })

  test("gemini vendor builds gemini chat command", () => {
    const res = buildResume({
      vendor: "gemini",
      sessionId: "s",
      cwd: "/tmp",
      continueFromLastTurn: false,
    })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.command.argv[0]).toBe("gemini")
  })
})
