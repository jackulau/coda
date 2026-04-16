import { describe, expect, test } from "bun:test"
import { findAcrossFiles, findInText, replaceInText } from "./find"

describe("findInText", () => {
  test("empty needle returns no matches", () => {
    expect(findInText("hello world", "")).toEqual([])
  })

  test("plain text case-insensitive by default", () => {
    const out = findInText("Hello World\nhello there", "hello")
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ line: 1, column: 1, length: 5, text: "Hello" })
    expect(out[1]?.line).toBe(2)
  })

  test("case-sensitive flag", () => {
    const out = findInText("Hello World\nhello there", "hello", { caseSensitive: true })
    expect(out).toHaveLength(1)
    expect(out[0]?.line).toBe(2)
  })

  test("wholeWord excludes substrings", () => {
    const out = findInText("testing tested test", "test", { wholeWord: true })
    expect(out).toHaveLength(1)
    expect(out[0]?.column).toBe(16)
  })

  test("regex escapes special characters by default", () => {
    const out = findInText("price $5 + tax", "$5 + tax")
    expect(out).toHaveLength(1)
  })

  test("regex mode uses patterns", () => {
    const out = findInText("foo123 bar45", "\\d+", { regex: true })
    expect(out.map((m) => m.text)).toEqual(["123", "45"])
  })

  test("zero-width regex match doesn't infinite loop", () => {
    const out = findInText("abc", "(?=\\w)", { regex: true })
    expect(out).toEqual([])
  })
})

describe("replaceInText", () => {
  test("replaces plain text globally", () => {
    expect(replaceInText("a b a b a", "a", { replacement: "X" })).toBe("X b X b X")
  })

  test("regex replace supports $1 backrefs", () => {
    expect(
      replaceInText("hello world", "(\\w+) (\\w+)", { regex: true, replacement: "$2 $1" }),
    ).toBe("world hello")
  })

  test("wholeWord replace", () => {
    expect(
      replaceInText("test testing tested", "test", { replacement: "X", wholeWord: true }),
    ).toBe("X testing tested")
  })
})

describe("findAcrossFiles", () => {
  test("returns only files with matches", () => {
    const out = findAcrossFiles(
      [
        { path: "a.ts", content: "const x = 1" },
        { path: "b.ts", content: "nothing relevant" },
        { path: "c.ts", content: "const y = 2\nconst z = 3" },
      ],
      "const",
    )
    expect(out.map((f) => f.path)).toEqual(["a.ts", "c.ts"])
    expect(out[1]?.matches).toHaveLength(2)
  })
})
