import { describe, expect, test } from "bun:test"
import { NotificationQueue } from "./queue"

describe("NotificationQueue", () => {
  test("enqueue appends a new notification", () => {
    const q = new NotificationQueue({ now: () => 0 })
    const n = q.enqueue({ level: "info", message: "hi" })
    expect(q.list()).toHaveLength(1)
    expect(n.level).toBe("info")
  })

  test("capacity drops oldest when exceeded", () => {
    const q = new NotificationQueue({ capacity: 2, now: () => 0 })
    q.enqueue({ level: "info", message: "a" })
    q.enqueue({ level: "info", message: "b" })
    q.enqueue({ level: "info", message: "c" })
    expect(q.list().map((n) => n.message)).toEqual(["b", "c"])
  })

  test("dedup key refreshes existing entry rather than stacking", () => {
    let now = 0
    const q = new NotificationQueue({ now: () => now, defaultTtlMs: 1000 })
    const a = q.enqueue({ level: "info", message: "a", dedupKey: "save" })
    now = 500
    const b = q.enqueue({ level: "warning", message: "b", dedupKey: "save" })
    expect(q.list()).toHaveLength(1)
    expect(a.id).toBe(b.id)
    expect(b.level).toBe("warning")
    expect(b.expiresAt).toBe(1500)
  })

  test("sweep removes expired entries and returns count", () => {
    let now = 0
    const q = new NotificationQueue({ now: () => now, defaultTtlMs: 100 })
    q.enqueue({ level: "info", message: "a" })
    q.enqueue({ level: "info", message: "b" })
    now = 500
    expect(q.sweep()).toBe(2)
    expect(q.list()).toHaveLength(0)
  })

  test("dismiss removes by id", () => {
    const q = new NotificationQueue({ now: () => 0 })
    const n = q.enqueue({ level: "info", message: "a" })
    expect(q.dismiss(n.id)).toBe(true)
    expect(q.dismiss(n.id)).toBe(false)
  })

  test("clear empties everything", () => {
    const q = new NotificationQueue({ now: () => 0 })
    q.enqueue({ level: "info", message: "a" })
    q.enqueue({ level: "info", message: "b" })
    q.clear()
    expect(q.list()).toEqual([])
  })
})
