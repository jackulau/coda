import { describe, expect, test } from "bun:test"
import { SETTINGS_CATALOG, applyDefaults, byCategory, findEntry, validateValue } from "./schema"

describe("SETTINGS_CATALOG", () => {
  test("has at least one entry per declared category", () => {
    const cats = new Set(SETTINGS_CATALOG.map((s) => s.category))
    expect(cats.size).toBeGreaterThan(4)
  })

  test("keys are unique", () => {
    const keys = new Set(SETTINGS_CATALOG.map((s) => s.key))
    expect(keys.size).toBe(SETTINGS_CATALOG.length)
  })

  test("select entries always have options", () => {
    for (const s of SETTINGS_CATALOG) {
      if (s.type === "select") expect(Array.isArray(s.options)).toBe(true)
    }
  })
})

describe("byCategory", () => {
  test("groups into declared categories", () => {
    const groups = byCategory()
    expect(groups.editor.length).toBeGreaterThan(0)
    expect(groups.terminal.length).toBeGreaterThan(0)
  })
})

describe("applyDefaults", () => {
  test("returns flat map with every key", () => {
    const d = applyDefaults()
    for (const entry of SETTINGS_CATALOG) {
      expect(Object.prototype.hasOwnProperty.call(d, entry.key)).toBe(true)
    }
  })
})

describe("validateValue", () => {
  test("number out of range rejected", () => {
    const entry = findEntry("editor.fontSize")
    if (!entry) throw new Error("missing entry")
    expect(validateValue(entry, 8)).toBe("must be ≥ 10")
    expect(validateValue(entry, 50)).toBe("must be ≤ 24")
    expect(validateValue(entry, 14)).toBe(true)
  })

  test("select rejects unknown option", () => {
    const entry = findEntry("updates.channel")
    if (!entry) throw new Error("missing entry")
    expect(typeof validateValue(entry, "nightly")).toBe("string")
    expect(validateValue(entry, "stable")).toBe(true)
  })

  test("boolean type enforced", () => {
    const entry = findEntry("editor.autoSave")
    if (!entry) throw new Error("missing entry")
    expect(validateValue(entry, true)).toBe(true)
    expect(validateValue(entry, "yes")).toBe("must be boolean")
  })
})
