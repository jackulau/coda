import { describe, expect, test } from "bun:test"
import { type DiffComment, DiffCommentStore } from "./store"

const seed = (
  overrides: Partial<DiffComment> = {},
): Omit<DiffComment, "resolved" | "resolvedAt"> => ({
  id: "c1",
  sessionId: "s1",
  workspaceId: "w1",
  file: "src/app.ts",
  lineNumber: 10,
  body: "looks off",
  author: "agent",
  createdAt: 1,
  ...overrides,
})

describe("DiffCommentStore", () => {
  test("create → listBySession returns it", () => {
    const s = new DiffCommentStore()
    s.create(seed())
    expect(s.listBySession("s1")).toHaveLength(1)
  })

  test("resolve sets resolved + timestamp; emits event", () => {
    const s = new DiffCommentStore()
    const events: unknown[] = []
    s.onEvent((e) => events.push(e))
    s.create(seed())
    expect(s.resolve("c1", 10)).toBe(true)
    const [c] = s.listBySession("s1")
    expect(c?.resolved).toBe(true)
    expect(c?.resolvedAt).toBe(10)
    expect(events.some((e) => (e as { kind: string }).kind === "diff_comment.resolved")).toBe(true)
  })

  test("resolve twice is a no-op", () => {
    const s = new DiffCommentStore()
    s.create(seed())
    s.resolve("c1", 1)
    expect(s.resolve("c1", 2)).toBe(false)
  })

  test("unresolve flips back", () => {
    const s = new DiffCommentStore()
    s.create(seed())
    s.resolve("c1", 1)
    expect(s.unresolve("c1")).toBe(true)
    const [c] = s.listBySession("s1")
    expect(c?.resolved).toBe(false)
    expect(c?.resolvedAt).toBeNull()
  })

  test("delete emits event and removes", () => {
    const s = new DiffCommentStore()
    s.create(seed())
    const events: unknown[] = []
    s.onEvent((e) => events.push(e))
    expect(s.delete("c1")).toBe(true)
    expect(s.listBySession("s1")).toEqual([])
    expect(events[0]).toEqual({ kind: "diff_comment.deleted", id: "c1" })
  })

  test("listByFile filters by file", () => {
    const s = new DiffCommentStore()
    s.create(seed({ id: "c1", file: "a.ts" }))
    s.create(seed({ id: "c2", file: "b.ts" }))
    expect(s.listByFile("s1", "b.ts").map((c) => c.id)).toEqual(["c2"])
  })

  test("countByFile groups", () => {
    const s = new DiffCommentStore()
    s.create(seed({ id: "c1", file: "a.ts" }))
    s.create(seed({ id: "c2", file: "a.ts" }))
    s.create(seed({ id: "c3", file: "b.ts" }))
    expect(s.countByFile("s1")).toEqual({ "a.ts": 2, "b.ts": 1 })
  })

  test("list ordered by createdAt ascending", () => {
    const s = new DiffCommentStore()
    s.create(seed({ id: "late", createdAt: 10 }))
    s.create(seed({ id: "early", createdAt: 1 }))
    expect(s.listBySession("s1").map((c) => c.id)).toEqual(["early", "late"])
  })
})
