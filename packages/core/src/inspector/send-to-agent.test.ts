import { describe, expect, test } from "bun:test"
import {
  type InspectedElement,
  type TerminalHandle,
  formatBatchMessage,
  formatElementMessage,
  selectTargetTerminal,
} from "./send-to-agent"

const el = (o: Partial<InspectedElement> = {}): InspectedElement => ({
  tag: "button",
  selector: "button.primary",
  ...o,
})

describe("formatElementMessage", () => {
  test("includes tag + selector by default", () => {
    const { message } = formatElementMessage(el(), "change color to red")
    expect(message).toContain("tag: <button>")
    expect(message).toContain("selector: `button.primary`")
    expect(message).toContain("Instruction: change color to red")
  })

  test("includes framework + componentName when present", () => {
    const { message } = formatElementMessage(
      el({ framework: "react", componentName: "SubmitButton" }),
      "",
    )
    expect(message).toContain("framework: react: SubmitButton")
  })

  test("includes source file with line", () => {
    const { message } = formatElementMessage(el({ sourceFile: "src/Btn.tsx", sourceLine: 42 }), "")
    expect(message).toContain("src/Btn.tsx:42")
  })

  test("includes authored CSS when non-empty", () => {
    const { message } = formatElementMessage(
      el({ cssAuthored: { color: "red", "font-size": "14px" } }),
      "",
    )
    expect(message).toContain("color: red")
    expect(message).toContain("font-size: 14px")
  })

  test("truncates instruction > maxInstructionChars", () => {
    const long = "x".repeat(10_000)
    const r = formatElementMessage(el(), long, { maxInstructionChars: 100 })
    expect(r.truncatedInstruction).toBe(true)
    expect(r.message).toContain("truncated")
  })

  test("empty instruction omits Instruction line", () => {
    const { message } = formatElementMessage(el(), "")
    expect(message).not.toContain("Instruction:")
  })
})

describe("formatBatchMessage", () => {
  test("renders N sections + common instruction", () => {
    const out = formatBatchMessage([el({ selector: "a" }), el({ selector: "b" })], "inspect")
    expect(out).toContain("Element 1")
    expect(out).toContain("Element 2")
    expect(out).toContain("Instruction: inspect")
  })
})

const t = (o: Partial<TerminalHandle>): TerminalHandle => ({
  id: o.id ?? "t1",
  name: o.name ?? "Terminal",
  lastActiveAt: o.lastActiveAt ?? 0,
  agentActive: o.agentActive ?? false,
})

describe("selectTargetTerminal", () => {
  test("preferred id wins", () => {
    const terms = [t({ id: "a", agentActive: true }), t({ id: "b", agentActive: true })]
    expect(selectTargetTerminal(terms, "b")?.id).toBe("b")
  })

  test("most recently active agent terminal", () => {
    const terms = [
      t({ id: "a", agentActive: true, lastActiveAt: 10 }),
      t({ id: "b", agentActive: true, lastActiveAt: 20 }),
    ]
    expect(selectTargetTerminal(terms)?.id).toBe("b")
  })

  test("no agent active → null", () => {
    const terms = [t({ id: "a" }), t({ id: "b" })]
    expect(selectTargetTerminal(terms)).toBeNull()
  })

  test("preferred id missing → fall back to MRU", () => {
    const terms = [t({ id: "a", agentActive: true, lastActiveAt: 10 })]
    expect(selectTargetTerminal(terms, "gone")?.id).toBe("a")
  })
})
