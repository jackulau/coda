import { describe, expect, test } from "bun:test"
import { EditorBuffer } from "./buffer"

describe("EditorBuffer", () => {
  test("reads text + lineCount", () => {
    const b = new EditorBuffer("a\nb\nc")
    expect(b.lineCount()).toBe(3)
    expect(b.lineAt(2)).toBe("b")
    expect(b.text()).toBe("a\nb\nc")
  })

  test("single-line replacement updates text + revision + dirty", () => {
    const b = new EditorBuffer("hello world")
    expect(b.isDirty()).toBe(false)
    b.applyEdit({
      range: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 12 },
      insertText: "there",
    })
    expect(b.text()).toBe("hello there")
    expect(b.isDirty()).toBe(true)
    expect(b.revisionNumber()).toBe(1)
  })

  test("multi-line insert expands lineCount", () => {
    const b = new EditorBuffer("a\nz")
    b.applyEdit({
      range: { startLine: 1, startColumn: 2, endLine: 1, endColumn: 2 },
      insertText: "bc\nd",
    })
    expect(b.text()).toBe("abc\nd\nz")
    expect(b.lineCount()).toBe(3)
  })

  test("range crossing lines deletes + replaces", () => {
    const b = new EditorBuffer("line1\nline2\nline3")
    b.applyEdit({
      range: { startLine: 1, startColumn: 6, endLine: 3, endColumn: 1 },
      insertText: "",
    })
    expect(b.text()).toBe("line1line3")
  })

  test("markSaved clears dirty", () => {
    const b = new EditorBuffer("x")
    b.applyEdit({
      range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
      insertText: "y",
    })
    b.markSaved()
    expect(b.isDirty()).toBe(false)
  })

  test("applyMany applies descending-sorted edits cleanly", () => {
    const b = new EditorBuffer("aaa bbb ccc")
    b.applyMany([
      {
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4 },
        insertText: "X",
      },
      {
        range: { startLine: 1, startColumn: 9, endLine: 1, endColumn: 12 },
        insertText: "Y",
      },
    ])
    expect(b.text()).toBe("X bbb Y")
  })

  test("out-of-bounds line throws", () => {
    const b = new EditorBuffer("one")
    expect(() =>
      b.applyEdit({
        range: { startLine: 99, startColumn: 1, endLine: 99, endColumn: 1 },
        insertText: "x",
      }),
    ).toThrow(/out of bounds/)
  })
})
