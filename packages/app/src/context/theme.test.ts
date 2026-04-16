import { describe, expect, test } from "bun:test"
import { resolvePreference } from "./theme"

describe("theme context (D4, V3)", () => {
  test("default is Coda Dark with motion on", () => {
    const p = resolvePreference({})
    expect(p.id).toBe("coda-dark")
    expect(p.reducedMotion).toBe(false)
  })

  test("unknown id falls back to Coda Dark", () => {
    expect(resolvePreference({ id: "nope" }).id).toBe("coda-dark")
  })

  test("known id is preserved", () => {
    expect(resolvePreference({ id: "dracula" }).id).toBe("dracula")
  })

  test("reducedMotion flag is preserved", () => {
    expect(resolvePreference({ reducedMotion: true }).reducedMotion).toBe(true)
  })
})
