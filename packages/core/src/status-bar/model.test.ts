import { describe, expect, test } from "bun:test"
import { StatusBarModel, summaryText } from "./model"

describe("StatusBarModel", () => {
  test("upsert + render splits by side", () => {
    const m = new StatusBarModel()
    m.upsert({ id: "a", side: "left", text: "branch", priority: 1 })
    m.upsert({ id: "b", side: "right", text: "line:col", priority: 1 })
    const out = m.render()
    expect(out.left.map((i) => i.id)).toEqual(["a"])
    expect(out.right.map((i) => i.id)).toEqual(["b"])
  })

  test("error severity ranks above warn and info", () => {
    const m = new StatusBarModel()
    m.upsert({ id: "ok", side: "left", text: "ok", priority: 100, severity: "info" })
    m.upsert({ id: "warn", side: "left", text: "warn", priority: 0, severity: "warn" })
    m.upsert({ id: "err", side: "left", text: "err", priority: 0, severity: "error" })
    expect(m.render().left.map((i) => i.id)).toEqual(["err", "warn", "ok"])
  })

  test("same severity sorted by priority desc", () => {
    const m = new StatusBarModel()
    m.upsert({ id: "low", side: "left", text: "lo", priority: 1 })
    m.upsert({ id: "high", side: "left", text: "hi", priority: 10 })
    expect(m.render().left.map((i) => i.id)).toEqual(["high", "low"])
  })

  test("onChange fires on upsert + remove", () => {
    const m = new StatusBarModel()
    const events: number[] = []
    m.onChange((items) => events.push(items.length))
    m.upsert({ id: "a", side: "left", text: "x", priority: 0 })
    m.upsert({ id: "b", side: "left", text: "y", priority: 0 })
    m.remove("a")
    expect(events).toEqual([1, 2, 1])
  })
})

describe("summaryText", () => {
  test("zero / zero → No problems", () => {
    expect(summaryText({ errors: 0, warnings: 0 })).toBe("No problems")
  })
  test("singular forms", () => {
    expect(summaryText({ errors: 1, warnings: 1 })).toBe("1 error, 1 warning")
  })
  test("plural + pluralized", () => {
    expect(summaryText({ errors: 3, warnings: 5 })).toBe("3 errors, 5 warnings")
  })
})
