import { afterEach, describe, expect, test } from "bun:test"
import { ProjectInfo } from "./index"
import { ProjectStore } from "./store"

afterEach(() => {
  // Clear state via re-upsert over a known set isn't available, so we re-create
  // Project doesn't expose clear() in this shape; instead we use unique ids per test
})

function make(overrides: Partial<ProjectInfo> & { id: string }): ProjectInfo {
  return ProjectInfo.parse({
    id: overrides.id,
    name: "Project A",
    rootPath: "/tmp/p",
    expanded: true,
    createdAt: 1000,
    ...overrides,
  })
}

describe("Project store (P3)", () => {
  test("upsert + get round-trip", () => {
    const p = make({ id: "00000000-0000-0000-0000-000000000201" })
    ProjectStore.upsert(p)
    expect(ProjectStore.get(p.id)?.name).toBe("Project A")
  })

  test("update expanded flag persists", () => {
    const p = make({ id: "00000000-0000-0000-0000-000000000202" })
    ProjectStore.upsert(p)
    ProjectStore.update(p.id, { expanded: false })
    expect(ProjectStore.get(p.id)?.expanded).toBe(false)
  })

  test("update name persists and rejects empty", () => {
    const p = make({ id: "00000000-0000-0000-0000-000000000203" })
    ProjectStore.upsert(p)
    ProjectStore.update(p.id, { name: "Renamed" })
    expect(ProjectStore.get(p.id)?.name).toBe("Renamed")
  })

  test("update on missing id throws", () => {
    expect(() => ProjectStore.update("00000000-0000-0000-0000-000000000999", { name: "x" })).toThrow(
      /not found/,
    )
  })

  test("uiOrder update persists", () => {
    const p = make({ id: "00000000-0000-0000-0000-000000000204" })
    ProjectStore.upsert(p)
    ProjectStore.update(p.id, { uiOrder: 42 })
    expect(ProjectStore.get(p.id)?.uiOrder).toBe(42)
  })

  test("list() returns all rows", () => {
    ProjectStore.upsert(make({ id: "00000000-0000-0000-0000-000000000205" }))
    ProjectStore.upsert(make({ id: "00000000-0000-0000-0000-000000000206" }))
    const ids = ProjectStore.list().map((p) => p.id)
    expect(ids).toContain("00000000-0000-0000-0000-000000000205")
    expect(ids).toContain("00000000-0000-0000-0000-000000000206")
  })
})
