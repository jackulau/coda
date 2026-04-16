import { describe, expect, test } from "bun:test"
import { SETTINGS_VERSION, defaultSettings, deserialize, migrate, serialize } from "./persistence"

describe("Settings persistence", () => {
  test("defaults match declared version", () => {
    expect(defaultSettings().version).toBe(SETTINGS_VERSION)
  })

  test("serialize / deserialize round trip", () => {
    const s = defaultSettings()
    s.theme.mode = "light"
    s.editor.fontSize = 15
    const out = deserialize(serialize(s))
    expect(out.theme.mode).toBe("light")
    expect(out.editor.fontSize).toBe(15)
  })

  test("v1 migrates to v2 preserving theme + telemetry", () => {
    const v1 = { version: 1, theme: { mode: "light" }, telemetryEnabled: false }
    const out = migrate(v1)
    expect(out.version).toBe(SETTINGS_VERSION)
    expect(out.theme.mode).toBe("light")
    expect(out.telemetryEnabled).toBe(false)
    expect(out.terminal.fontSize).toBe(13)
  })

  test("unknown version → defaults", () => {
    expect(migrate({ version: 99 }).version).toBe(SETTINGS_VERSION)
  })

  test("malformed JSON → defaults without throwing", () => {
    expect(deserialize("{not json")).toEqual(defaultSettings())
  })

  test("invalid fontSize rejected by schema", () => {
    const s = defaultSettings()
    s.editor.fontSize = 100 as unknown as number
    expect(() => serialize(s)).toThrow()
  })

  test("fontSize accepts bounds 10..24", () => {
    const s = defaultSettings()
    s.editor.fontSize = 10
    expect(() => serialize(s)).not.toThrow()
    s.editor.fontSize = 24
    expect(() => serialize(s)).not.toThrow()
  })
})
