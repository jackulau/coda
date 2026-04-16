import { describe, expect, test } from "bun:test"
import {
  type DocumentSymbol,
  LspPendingQueue,
  decodeSemanticTokens,
  flattenSymbols,
  summarizeRename,
} from "./features"

describe("decodeSemanticTokens", () => {
  test("decodes two tokens with deltaLine/deltaChar semantics", () => {
    const out = decodeSemanticTokens({
      data: [
        0,
        0,
        5,
        0,
        0, // line 0, char 0, len 5, type 0, no mod
        1,
        2,
        3,
        1,
        0b11, // line 1, char 2, len 3, type 1, mod bits 0+1
      ],
      types: ["keyword", "variable"],
      modifiers: ["readonly", "static"],
    })
    expect(out[0]).toEqual({ line: 0, char: 0, length: 5, type: "keyword", modifiers: [] })
    expect(out[1]).toEqual({
      line: 1,
      char: 2,
      length: 3,
      type: "variable",
      modifiers: ["readonly", "static"],
    })
  })

  test("unknown type index → unknown", () => {
    const out = decodeSemanticTokens({
      data: [0, 0, 1, 99, 0],
      types: ["keyword"],
      modifiers: [],
    })
    expect(out[0]?.type).toBe("unknown")
  })
})

describe("summarizeRename", () => {
  test("counts unique files + total edits", () => {
    const s = summarizeRename({
      edits: [
        {
          file: "a.ts",
          range: { startLine: 1, startChar: 0, endLine: 1, endChar: 3 },
          newText: "foo",
        },
        {
          file: "a.ts",
          range: { startLine: 2, startChar: 0, endLine: 2, endChar: 3 },
          newText: "foo",
        },
        {
          file: "b.ts",
          range: { startLine: 1, startChar: 0, endLine: 1, endChar: 3 },
          newText: "foo",
        },
      ],
    })
    expect(s.filesTouched).toBe(2)
    expect(s.totalEdits).toBe(3)
    expect(s.byFile).toEqual({ "a.ts": 2, "b.ts": 1 })
  })
})

describe("flattenSymbols", () => {
  test("depth-first order", () => {
    const cls: DocumentSymbol = {
      name: "Foo",
      kind: "class",
      line: 1,
      children: [
        { name: "bar", kind: "method", line: 2, children: [] },
        { name: "baz", kind: "method", line: 5, children: [] },
      ],
    }
    const flat = flattenSymbols([cls])
    expect(flat.map((s) => s.name)).toEqual(["Foo", "bar", "baz"])
  })
})

describe("LspPendingQueue", () => {
  test("cap evicts oldest", () => {
    const q = new LspPendingQueue(2)
    q.add({ id: 1, method: "x", sentAt: 1 })
    q.add({ id: 2, method: "y", sentAt: 2 })
    const evicted = q.add({ id: 3, method: "z", sentAt: 3 })
    expect(q.size()).toBe(2)
    expect(evicted?.id).toBe(1)
  })

  test("complete removes entry and returns it", () => {
    const q = new LspPendingQueue()
    q.add({ id: 1, method: "x", sentAt: 1 })
    expect(q.complete(1)?.id).toBe(1)
    expect(q.size()).toBe(0)
  })

  test("timedOut returns stale + removes them", () => {
    const q = new LspPendingQueue(10, 1000)
    q.add({ id: 1, method: "x", sentAt: 1 })
    q.add({ id: 2, method: "y", sentAt: 2000 })
    const stale = q.timedOut(2500)
    expect(stale.map((r) => r.id)).toEqual([1])
    expect(q.size()).toBe(1)
  })
})
