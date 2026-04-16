import { describe, expect, test } from "bun:test"
import { terminalThemeFor } from "./terminal-theme"

describe("terminal theme extension (D4)", () => {
  test("maps a known theme id to the terminal palette", () => {
    const p = terminalThemeFor("monokai")
    expect(p.background).toBe("#272822")
  })

  test("unknown theme id throws", () => {
    expect(() => terminalThemeFor("nope")).toThrow(/unknown theme/)
  })
})
