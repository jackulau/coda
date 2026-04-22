import { describe, expect, test } from "bun:test"
import { editorThemeFor } from "./editor-theme-extension"

describe("editor theme extension (D4)", () => {
  test("maps a known theme id to the editor palette", () => {
    const p = editorThemeFor("coda-dark")
    expect(p.background).toBe("#0b0b0d")
    expect(p.accent).toBe("#ff7a1a")
  })

  test("vesper theme returns correct palette", () => {
    const p = editorThemeFor("vesper")
    expect(p.background).toBe("#101010")
    expect(p.foreground).toBe("#b0b0b0")
    expect(p.accent).toBe("#FFC799")
  })

  test("unknown theme id falls back to vesper instead of throwing", () => {
    const p = editorThemeFor("totally-unknown-theme")
    expect(p.background).toBe("#101010")
    expect(p.foreground).toBe("#b0b0b0")
    expect(p.accent).toBe("#FFC799")
  })
})
