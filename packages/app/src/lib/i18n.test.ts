import { describe, expect, test } from "bun:test"
import { setLocale, t } from "./i18n"
import { en } from "./locales/en"

describe("t()", () => {
  test('returns "Appearance" for "settings.appearance" in English locale', () => {
    setLocale("en")
    expect(t("settings.appearance")).toBe("Appearance")
  })

  test("returns the key itself for a nonexistent key (fallback)", () => {
    setLocale("en")
    expect(t("nonexistent.key")).toBe("nonexistent.key")
  })

  test("returns English value when locale is set to a stub language", () => {
    setLocale("fr")
    expect(t("settings.appearance")).toBe("Appearance")
  })

  test("returns English value when locale is set to another stub language", () => {
    setLocale("zh-CN")
    expect(t("settings.terminal")).toBe("Terminal")
  })
})

describe("setLocale()", () => {
  test("switching locale changes t() output reactively", () => {
    setLocale("en")
    expect(t("settings.git")).toBe("Git")
    setLocale("de")
    // German is a stub (copy of English), so same value
    expect(t("settings.git")).toBe("Git")
    setLocale("en")
  })
})

describe("English locale completeness", () => {
  // All keys used in settings.tsx must be present
  const requiredKeys = [
    // Nav sections
    "settings.appearance",
    "settings.keyboard",
    "settings.terminal",
    "settings.updates",
    "settings.git",
    "settings.about",
    // Appearance
    "settings.theme",
    "settings.uiFontSize",
    "settings.reducedMotion",
    // Terminal
    "settings.terminalFontSize",
    "settings.terminalShell",
    // Updates
    "settings.updatesChannel",
    "settings.checkForUpdates",
    // Git
    "settings.githubPat",
    // Close
    "settings.close",
  ]

  test("all settings.tsx keys are present in the English locale map", () => {
    for (const key of requiredKeys) {
      expect(en[key]).toBeDefined()
    }
  })

  test("no English locale value is an empty string", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.length).toBeGreaterThan(0)
    }
  })
})
