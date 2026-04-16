import { describe, expect, test } from "bun:test"
import { editorThemeFor } from "./editor-theme-extension"

describe("editor theme extension (D4)", () => {
  test("maps a known theme id to the editor palette", () => {
    const p = editorThemeFor("coda-dark")
    expect(p.background).toBe("#0b0b0d")
    expect(p.accent).toBe("#ff7a1a")
  })

  test("unknown theme id throws", () => {
    expect(() => editorThemeFor("nope")).toThrow(/unknown theme/)
  })
})
