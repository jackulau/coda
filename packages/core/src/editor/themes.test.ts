import { describe, expect, test } from "bun:test"
import { ThemeCatalog, builtinThemes } from "./themes"

describe("ThemeCatalog", () => {
  test("ships with built-in themes", () => {
    const cat = new ThemeCatalog()
    const ids = cat.list().map((t) => t.id)
    expect(ids).toContain("coda-dark")
    expect(ids).toContain("dracula")
    expect(ids).toContain("coda-light")
  })

  test("byKind filters dark vs light", () => {
    const cat = new ThemeCatalog()
    expect(cat.byKind("light").map((t) => t.id)).toEqual(["coda-light"])
  })

  test("register rejects invalid hex", () => {
    const cat = new ThemeCatalog()
    expect(() =>
      cat.register({
        id: "bad",
        name: "Bad",
        kind: "dark",
        colors: { "editor.background": "not-hex" },
        tokenColors: [],
      }),
    ).toThrow()
  })

  test("register rejects invalid id chars", () => {
    const cat = new ThemeCatalog()
    expect(() =>
      cat.register({
        id: "Bad ID!",
        name: "x",
        kind: "dark",
        colors: {},
        tokenColors: [],
      }),
    ).toThrow()
  })

  test("builtinThemes() deep-validates every entry", () => {
    expect(() => builtinThemes()).not.toThrow()
    expect(builtinThemes().length).toBeGreaterThan(0)
  })
})
