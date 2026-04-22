import { describe, expect, test } from "bun:test"
import { terminalThemeFor } from "./terminal-theme"

const THEME_IDS = [
  "vesper",
  "oc-1",
  "oc-2",
  "aura",
  "ayu",
  "carbonfox",
  "catppuccin",
  "dracula",
  "monokai",
  "night-owl",
  "nord",
  "one-dark-pro",
  "shades-of-purple",
  "solarized",
  "tokyonight",
]

describe("terminal theme extension (D4)", () => {
  test("maps a known theme id to the terminal palette", () => {
    const p = terminalThemeFor("monokai")
    expect(p.background).toBe("#272822")
  })

  test("vesper theme returns correct palette", () => {
    const p = terminalThemeFor("vesper")
    expect(p.background).toBe("#101010")
    expect(p.foreground).toBe("#b0b0b0")
  })

  test("all THEME_OPTIONS IDs return valid palettes", () => {
    for (const id of THEME_IDS) {
      const p = terminalThemeFor(id)
      expect(p.background).toBeTypeOf("string")
      expect(p.foreground).toBeTypeOf("string")
      expect(p.background.startsWith("#")).toBe(true)
      expect(p.foreground.startsWith("#")).toBe(true)
    }
  })

  test("unknown theme id falls back to vesper instead of throwing", () => {
    const p = terminalThemeFor("totally-unknown-theme")
    expect(p.background).toBe("#101010")
    expect(p.foreground).toBe("#b0b0b0")
  })
})
