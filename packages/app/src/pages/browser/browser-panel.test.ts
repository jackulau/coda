import { describe, expect, test } from "bun:test"
import { type BrowserSettings, visibleDevTabs } from "../../pages/settings/settings-store"

const defaults: BrowserSettings = {
  enabled: true,
  elementInspector: true,
  consolePanel: true,
  networkPanel: true,
  defaultUrl: "",
}

describe("visibleDevTabs", () => {
  test("consolePanel true, networkPanel false returns ['console']", () => {
    expect(visibleDevTabs({ ...defaults, consolePanel: true, networkPanel: false })).toEqual([
      "console",
    ])
  })

  test("consolePanel false, networkPanel false returns []", () => {
    expect(visibleDevTabs({ ...defaults, consolePanel: false, networkPanel: false })).toEqual([])
  })

  test("consolePanel true, networkPanel true returns ['console', 'network']", () => {
    expect(visibleDevTabs({ ...defaults, consolePanel: true, networkPanel: true })).toEqual([
      "console",
      "network",
    ])
  })

  test("all panels disabled means empty array (hides devtools toggle)", () => {
    const result = visibleDevTabs({
      ...defaults,
      consolePanel: false,
      networkPanel: false,
      elementInspector: false,
    })
    expect(result).toEqual([])
    expect(result.length).toBe(0)
  })

  test("only networkPanel enabled returns ['network']", () => {
    expect(visibleDevTabs({ ...defaults, consolePanel: false, networkPanel: true })).toEqual([
      "network",
    ])
  })
})
