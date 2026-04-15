import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { codaBus } from "../event/bus"
import type { ProjectInfo } from "./index"
import { ProjectStore } from "./store"

const seed = (overrides: Partial<ProjectInfo> = {}): ProjectInfo => ({
  id: crypto.randomUUID(),
  name: "demo",
  rootPath: "/tmp/demo",
  expanded: true,
  createdAt: Date.now(),
  ...overrides,
})

describe("ProjectStore", () => {
  beforeEach(() => {
    ProjectStore.clear()
    codaBus.removeAll()
  })
  afterEach(() => {
    ProjectStore.clear()
    codaBus.removeAll()
  })

  test("update expanded persists and emits", () => {
    const p = seed()
    ProjectStore.upsert(p)
    const seen: boolean[] = []
    codaBus.on("Project.Updated", (e) => {
      if (e.expanded !== undefined) seen.push(e.expanded)
    })
    ProjectStore.update(p.id, { expanded: false })
    expect(ProjectStore.get(p.id)?.expanded).toBe(false)
    expect(seen).toEqual([false])
  })

  test("update with NaN uiOrder rejects", () => {
    const p = seed()
    ProjectStore.upsert(p)
    expect(() => ProjectStore.update(p.id, { uiOrder: Number.NaN })).toThrow()
  })

  test("collapsed project with zero workspaces round-trips", () => {
    const p = seed({ expanded: true })
    ProjectStore.upsert(p)
    ProjectStore.update(p.id, { expanded: false })
    expect(ProjectStore.get(p.id)?.expanded).toBe(false)
  })
})
