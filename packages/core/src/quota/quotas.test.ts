import { describe, expect, test } from "bun:test"
import { recommendedActions, shouldShed, tierFromAvailable } from "../perf/quotas"

describe("Resource quotas + graceful degradation ladder (J4)", () => {
  test("plenty of memory → comfortable tier, no shedding", () => {
    const tier = tierFromAvailable(4000)
    expect(tier.name).toBe("comfortable")
    expect(tier.shed).toEqual([])
  })

  test("≤800MB → elevated tier, trims pr-cache and history", () => {
    const tier = tierFromAvailable(700)
    expect(tier.name).toBe("elevated")
    expect(tier.shed).toContain("trim-pr-cache")
    expect(tier.shed).toContain("trim-history")
  })

  test("≤400MB → pressure tier, closes background tabs", () => {
    const tier = tierFromAvailable(350)
    expect(tier.name).toBe("pressure")
    expect(tier.shed).toContain("close-background-browser-tabs")
  })

  test("≤200MB → critical tier, drops undo stacks and evicts pty buffers", () => {
    const tier = tierFromAvailable(150)
    expect(tier.name).toBe("critical")
    expect(tier.shed).toContain("drop-undo-stacks")
    expect(tier.shed).toContain("evict-inactive-pty-buffers")
  })

  test("shouldShed returns true iff the tier's ladder includes the action", () => {
    expect(shouldShed(700, "trim-pr-cache")).toBe(true)
    expect(shouldShed(4000, "trim-pr-cache")).toBe(false)
  })

  test("recommendedActions returns full ladder for the tier", () => {
    const actions = recommendedActions(150)
    expect(actions.length).toBeGreaterThan(0)
    expect(actions).toContain("force-gc-hint")
  })

  test("tier transitions are monotone non-decreasing in aggression", () => {
    const comfortable = tierFromAvailable(5000).shed.length
    const elevated = tierFromAvailable(700).shed.length
    const pressure = tierFromAvailable(300).shed.length
    const critical = tierFromAvailable(100).shed.length
    expect(elevated).toBeGreaterThanOrEqual(comfortable)
    expect(pressure).toBeGreaterThanOrEqual(elevated)
    expect(critical).toBeGreaterThanOrEqual(pressure)
  })
})
