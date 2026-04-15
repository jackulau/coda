import { describe, expect, test } from "bun:test"
import { tokens } from "./tokens"

describe("design tokens", () => {
  test("brand accent matches Coda creature orange", () => {
    expect(tokens.color.accent[500]).toBe("#ff6b1a")
  })

  test("status colors align with motion-pulse target", () => {
    expect(tokens.color.statusRun).toBe(tokens.color.accent[500])
  })

  test("motion durations are sorted fast < base < slow", () => {
    const ms = (s: string) => Number.parseInt(s, 10)
    expect(ms(tokens.motion.fast)).toBeLessThan(ms(tokens.motion.base))
    expect(ms(tokens.motion.base)).toBeLessThan(ms(tokens.motion.slow))
  })

  test("spacing follows 4px grid", () => {
    for (const v of Object.values(tokens.spacing)) {
      expect(Number.parseInt(v, 10) % 4).toBe(0)
    }
  })

  test("PR-state badge palette is distinct", () => {
    const set = new Set([tokens.color.prOpen, tokens.color.prMerged, tokens.color.prClosed])
    expect(set.size).toBe(3)
  })
})
