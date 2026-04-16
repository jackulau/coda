import { describe, expect, test } from "bun:test"
import {
  type DiffChunk,
  type DiffLine,
  acceptChunk,
  computeCollapseRanges,
  detectLanguage,
  rejectChunk,
  toggleMode,
} from "./chunks"

const chunk = (overrides: Partial<DiffChunk> = {}): DiffChunk => ({
  id: "c1",
  startA: 0,
  endA: 1,
  startB: 0,
  endB: 1,
  lines: [
    { kind: "removed", text: "old" },
    { kind: "added", text: "new" },
  ],
  ...overrides,
})

describe("acceptChunk", () => {
  test("replaces old lines with added lines", () => {
    const out = acceptChunk(["old", "keep"], chunk())
    expect(out.kind).toBe("accepted")
    expect(out.resultLines).toEqual(["new", "keep"])
  })

  test("pure add chunk inserts", () => {
    const out = acceptChunk(
      ["keep"],
      chunk({
        startA: 1,
        endA: 1,
        lines: [{ kind: "added", text: "added" }],
      }),
    )
    expect(out.resultLines).toEqual(["keep", "added"])
  })
})

describe("rejectChunk", () => {
  test("keeps original (removed) lines", () => {
    const out = rejectChunk(["old", "keep"], chunk())
    expect(out.kind).toBe("rejected")
    expect(out.resultLines).toEqual(["old", "keep"])
  })

  test("removes added-only chunk", () => {
    const out = rejectChunk(
      ["keep"],
      chunk({
        startA: 1,
        endA: 1,
        lines: [{ kind: "added", text: "added" }],
      }),
    )
    expect(out.resultLines).toEqual(["keep"])
  })
})

describe("computeCollapseRanges", () => {
  test("collapses long context runs", () => {
    const lines: DiffLine[] = [
      { kind: "removed", text: "a" },
      ...Array.from({ length: 20 }, (_, i) => ({
        kind: "context" as const,
        text: `ctx${i}`,
      })),
      { kind: "added", text: "b" },
    ]
    const ranges = computeCollapseRanges(lines)
    expect(ranges).toHaveLength(1)
    expect(ranges[0]?.hiddenCount).toBe(14)
  })

  test("short context runs NOT collapsed (< min)", () => {
    const lines: DiffLine[] = [
      { kind: "removed", text: "a" },
      { kind: "context", text: "1" },
      { kind: "context", text: "2" },
      { kind: "context", text: "3" },
      { kind: "added", text: "b" },
    ]
    expect(computeCollapseRanges(lines)).toEqual([])
  })

  test("leading + trailing context preserved (context=3)", () => {
    const lines: DiffLine[] = Array.from({ length: 15 }, () => ({
      kind: "context" as const,
      text: "x",
    }))
    const ranges = computeCollapseRanges(lines)
    expect(ranges[0]?.startLine).toBe(3)
    expect(ranges[0]?.endLine).toBe(11)
  })
})

describe("detectLanguage", () => {
  test.each([
    ["app.ts", "typescript"],
    ["app.tsx", "typescript"],
    ["main.py", "python"],
    ["main.rs", "rust"],
    ["doc.md", "markdown"],
    ["unknown.xyz", "plaintext"],
  ])("%s → %s", (f, lang) => {
    expect(detectLanguage(f)).toBe(lang)
  })
})

describe("toggleMode", () => {
  test("unified ↔ split", () => {
    expect(toggleMode("unified")).toBe("split")
    expect(toggleMode("split")).toBe("unified")
  })
})
