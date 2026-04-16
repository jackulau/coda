import { describe, expect, test } from "bun:test"
import { createMotionPolicy, preferenceFromMedia } from "./motion"

describe("createMotionPolicy", () => {
  test("full preference returns default durations", () => {
    const p = createMotionPolicy("full")
    expect(p.transitionMs("fast")).toBe(120)
    expect(p.transitionMs("base")).toBe(180)
    expect(p.transitionMs("slow")).toBe(280)
    expect(p.pulseEnabled()).toBe(true)
  })

  test("reduced preference zeroes durations and disables pulse", () => {
    const p = createMotionPolicy("reduced")
    expect(p.transitionMs("fast")).toBe(0)
    expect(p.transitionMs("base")).toBe(0)
    expect(p.transitionMs("slow")).toBe(0)
    expect(p.pulseEnabled()).toBe(false)
  })
})

describe("preferenceFromMedia", () => {
  test("matches=true → reduced", () => {
    expect(preferenceFromMedia({ matches: true })).toBe("reduced")
  })
  test("matches=false → full", () => {
    expect(preferenceFromMedia({ matches: false })).toBe("full")
  })
  test("null → full (default)", () => {
    expect(preferenceFromMedia(null)).toBe("full")
  })
})
