import { describe, expect, test } from "bun:test"
import type { WorkspaceInfo } from "./index"
import { applyReorder, pinToggle } from "./reorder"

const ws = (overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo => ({
  id: crypto.randomUUID(),
  projectId: "p1",
  name: "w",
  cwd: "/w",
  baseBranch: "main",
  pinned: false,
  createdAt: 0,
  ...overrides,
})

describe("applyReorder", () => {
  test("dragging onto self → no change", () => {
    const a = ws({ name: "a" })
    const out = applyReorder({
      items: [a],
      draggedId: a.id,
      targetId: a.id,
      position: "before",
    })
    expect(out.changed).toBe(false)
  })

  test("reorders within same project (position: before)", () => {
    const a = ws({ name: "a", uiOrder: 100 })
    const b = ws({ name: "b", uiOrder: 200 })
    const c = ws({ name: "c", uiOrder: 300 })
    const out = applyReorder({
      items: [a, b, c],
      draggedId: c.id,
      targetId: a.id,
      position: "before",
    })
    expect(out.changed).toBe(true)
    const names = out.items.sort((x, y) => (x.uiOrder ?? 0) - (y.uiOrder ?? 0)).map((i) => i.name)
    expect(names).toEqual(["c", "a", "b"])
  })

  test("reorders within same project (position: after)", () => {
    const a = ws({ name: "a", uiOrder: 100 })
    const b = ws({ name: "b", uiOrder: 200 })
    const c = ws({ name: "c", uiOrder: 300 })
    const out = applyReorder({
      items: [a, b, c],
      draggedId: a.id,
      targetId: b.id,
      position: "after",
    })
    expect(out.changed).toBe(true)
    const names = out.items.sort((x, y) => (x.uiOrder ?? 0) - (y.uiOrder ?? 0)).map((i) => i.name)
    expect(names).toEqual(["b", "a", "c"])
  })

  test("cross-project drag re-parents", () => {
    const a = ws({ name: "a", projectId: "p1" })
    const b = ws({ name: "b", projectId: "p2" })
    const out = applyReorder({
      items: [a, b],
      draggedId: a.id,
      targetId: b.id,
      position: "after",
    })
    const moved = out.items.find((i) => i.id === a.id)
    expect(moved?.projectId).toBe("p2")
  })

  test("reorder with unknown ids → no-op", () => {
    const a = ws()
    const out = applyReorder({
      items: [a],
      draggedId: "ghost-a",
      targetId: "ghost-b",
      position: "before",
    })
    expect(out.changed).toBe(false)
  })

  test("uiOrder values are spaced by 100 after reorder", () => {
    const a = ws({ name: "a", uiOrder: 100 })
    const b = ws({ name: "b", uiOrder: 200 })
    const c = ws({ name: "c", uiOrder: 300 })
    const out = applyReorder({
      items: [a, b, c],
      draggedId: c.id,
      targetId: a.id,
      position: "before",
    })
    const orders = out.items.map((i) => i.uiOrder).sort((x, y) => (x ?? 0) - (y ?? 0))
    expect(orders).toEqual([100, 200, 300])
  })
})

describe("pinToggle", () => {
  test("only target row mutates", () => {
    const a = ws()
    const b = ws()
    const out = pinToggle([a, b], a.id, true)
    expect(out[0]?.pinned).toBe(true)
    expect(out[1]?.pinned).toBe(false)
    expect(out[1]).toBe(b)
  })
})
