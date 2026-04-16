import { describe, expect, test } from "bun:test"
import { advance, canAdvance, goBack, initialWizard, isComplete } from "./wizard"

describe("Onboarding wizard", () => {
  test("starts at welcome", () => {
    expect(initialWizard().current).toBe("welcome")
  })

  test("welcome advances without any gating", () => {
    expect(canAdvance(initialWizard())).toBe(true)
    expect(advance(initialWizard()).current).toBe("add-project")
  })

  test("add-project blocks until firstProjectPath set", () => {
    const s = advance(initialWizard())
    expect(canAdvance(s)).toBe(false)
    const s2 = { ...s, firstProjectPath: "/tmp/demo" }
    expect(canAdvance(s2)).toBe(true)
    expect(advance(s2).current).toBe("github-auth")
  })

  test("github-auth can be skipped", () => {
    const s = { ...initialWizard(), current: "github-auth" as const }
    expect(canAdvance(s)).toBe(true)
    expect(advance(s).current).toBe("pick-theme")
  })

  test("pick-theme blocks until themeChosen", () => {
    const s = { ...initialWizard(), current: "pick-theme" as const }
    expect(canAdvance(s)).toBe(false)
    const s2 = { ...s, themeChosen: true }
    expect(advance(s2).current).toBe("done")
  })

  test("done never advances further", () => {
    const s = { ...initialWizard(), current: "done" as const }
    expect(canAdvance(s)).toBe(false)
    expect(advance(s).current).toBe("done")
  })

  test("goBack walks backward, stops at welcome", () => {
    let s = initialWizard()
    s = advance(s)
    expect(goBack(s).current).toBe("welcome")
    expect(goBack(goBack(s)).current).toBe("welcome")
  })

  test("isComplete at done only", () => {
    expect(isComplete(initialWizard())).toBe(false)
    expect(isComplete({ ...initialWizard(), current: "done" })).toBe(true)
  })
})
