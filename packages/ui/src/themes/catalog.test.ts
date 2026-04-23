import { describe, expect, test } from "bun:test"
import { THEMES, findTheme } from "./catalog"

/**
 * All theme IDs from the settings-store THEME_OPTIONS array.
 * findTheme() must resolve every one of these.
 */
const THEME_OPTION_IDS = [
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

describe("theme catalog", () => {
  test("default Coda Dark theme is present", () => {
    const t = findTheme("coda-dark")
    expect(t?.label).toBe("Coda Dark")
  })

  test("catalog has at least 15 themes", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(15)
  })

  test("every THEME_OPTIONS id resolves via findTheme()", () => {
    for (const id of THEME_OPTION_IDS) {
      const t = findTheme(id)
      expect(t).toBeDefined()
      expect(t?.id).toBe(id)
    }
  })

  test("all colors are valid hex strings", () => {
    const hexRe = /^#[0-9a-f]{3,8}$/i
    for (const t of THEMES) {
      expect(t.editorPalette.background).toMatch(hexRe)
      expect(t.editorPalette.foreground).toMatch(hexRe)
      expect(t.editorPalette.accent).toMatch(hexRe)
      expect(t.terminalPalette.background).toMatch(hexRe)
      expect(t.terminalPalette.foreground).toMatch(hexRe)
    }
  })

  test("no duplicate theme IDs", () => {
    const ids = THEMES.map((t) => t.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  test("every theme has an accent color", () => {
    for (const t of THEMES) {
      expect(t.editorPalette.accent).toMatch(/^#[0-9a-f]{3,8}$/i)
    }
  })

  test("findTheme returns undefined for unknown id", () => {
    expect(findTheme("nope")).toBeUndefined()
  })

  test("existing themes are still present (regression)", () => {
    const existing = ["coda-dark", "monokai", "dracula", "one-dark-pro", "github-light"]
    for (const id of existing) {
      expect(findTheme(id)).toBeDefined()
    }
  })

  test("every theme has correct kind value", () => {
    for (const t of THEMES) {
      expect(["dark", "light"]).toContain(t.kind)
    }
  })
})
