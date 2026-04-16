import { describe, expect, test } from "bun:test"
import { THEMES, findTheme } from "./catalog"

describe("theme catalog (D4)", () => {
  test("default Coda Dark theme is present", () => {
    const t = findTheme("coda-dark")
    expect(t?.label).toBe("Coda Dark")
  })

  test("all five shipped themes are present", () => {
    const ids = THEMES.map((t) => t.id).sort()
    expect(ids).toEqual(["coda-dark", "dracula", "github-light", "monokai", "one-dark-pro"].sort())
  })

  test("every theme has an accent color", () => {
    for (const t of THEMES) {
      expect(t.editorPalette.accent).toMatch(/^#[0-9a-f]{3,6}$/i)
    }
  })

  test("findTheme returns undefined for unknown id", () => {
    expect(findTheme("nope")).toBeUndefined()
  })
})
