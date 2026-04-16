import { describe, expect, test } from "bun:test"
import { defaultFeatures, overlay } from "./features"

describe("editor features", () => {
  test("defaults are on for common features", () => {
    const f = defaultFeatures()
    expect(f.autoSave).toBe(true)
    expect(f.minimap).toBe(true)
    expect(f.zenMode).toBe(false)
  })

  test("overlay replaces only listed keys", () => {
    const f = defaultFeatures()
    const out = overlay(f, { zenMode: true })
    expect(out.zenMode).toBe(true)
    expect(out.autoSave).toBe(true)
  })

  test("overlay rejects invalid renderWhitespace", () => {
    expect(() =>
      overlay(defaultFeatures(), { renderWhitespace: "nope" as unknown as "none" }),
    ).toThrow()
  })
})
