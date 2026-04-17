import { createRoot } from "solid-js"
import { describe, expect, test, vi } from "vitest"
import { type BufferManager, createBufferManager } from "./buffer-manager"

function withRoot<T>(fn: () => T): T {
  let captured!: T
  createRoot((dispose) => {
    captured = fn()
    return dispose
  })
  return captured
}

describe("BufferManager (T8, logic)", () => {
  test("open_new_path_creates_buffer_and_focuses_it", async () => {
    const reader = vi.fn().mockResolvedValue("file-body")
    const mgr: BufferManager = withRoot(() => createBufferManager({ reader }))
    const b = await mgr.open("/a/b.ts")
    expect(b.path).toBe("/a/b.ts")
    expect(b.content).toBe("file-body")
    expect(b.dirty).toBe(false)
    expect(mgr.buffers().length).toBe(1)
    expect(mgr.active()).toBe("/a/b.ts")
    expect(reader).toHaveBeenCalledWith("/a/b.ts")
  })

  test("open_existing_path_focuses_without_duplicating", async () => {
    const reader = vi.fn().mockResolvedValue("x")
    const mgr = withRoot(() => createBufferManager({ reader }))
    await mgr.open("/a.ts")
    await mgr.open("/b.ts")
    await mgr.open("/a.ts")
    expect(mgr.buffers().length).toBe(2)
    expect(mgr.active()).toBe("/a.ts")
  })

  test("update_marks_buffer_dirty_and_bumps_version", async () => {
    const mgr = withRoot(() => createBufferManager({ reader: async () => "orig" }))
    await mgr.open("/a.ts")
    const before = mgr.buffers()[0]?.version ?? 0
    mgr.update("/a.ts", "changed")
    const after = mgr.buffers()[0]
    expect(after?.dirty).toBe(true)
    expect(after?.content).toBe("changed")
    expect((after?.version ?? 0) > before).toBe(true)
  })

  test("save_clears_dirty_and_promotes_content_to_original", async () => {
    const writer = vi.fn().mockResolvedValue(undefined)
    const mgr = withRoot(() => createBufferManager({ reader: async () => "orig", writer }))
    await mgr.open("/a.ts")
    mgr.update("/a.ts", "new")
    await mgr.save("/a.ts")
    expect(writer).toHaveBeenCalledWith("/a.ts", "new")
    const b = mgr.buffers()[0]
    expect(b?.dirty).toBe(false)
    expect(b?.original).toBe("new")
  })

  test("close_dirty_without_force_returns_false_and_keeps_buffer", async () => {
    const mgr = withRoot(() => createBufferManager({ reader: async () => "orig" }))
    await mgr.open("/a.ts")
    mgr.update("/a.ts", "edited")
    const ok = mgr.close("/a.ts")
    expect(ok).toBe(false)
    expect(mgr.buffers().length).toBe(1)
  })

  test("close_clean_removes_buffer", async () => {
    const mgr = withRoot(() => createBufferManager({ reader: async () => "orig" }))
    await mgr.open("/a.ts")
    expect(mgr.close("/a.ts")).toBe(true)
    expect(mgr.buffers().length).toBe(0)
    expect(mgr.active()).toBeNull()
  })

  test("close_dirty_force_removes_buffer", async () => {
    const mgr = withRoot(() => createBufferManager({ reader: async () => "orig" }))
    await mgr.open("/a.ts")
    mgr.update("/a.ts", "edited")
    expect(mgr.close("/a.ts", true)).toBe(true)
    expect(mgr.buffers().length).toBe(0)
  })

  test("close_active_promotes_last_remaining_buffer_to_active", async () => {
    const mgr = withRoot(() => createBufferManager({ reader: async () => "" }))
    await mgr.open("/a.ts")
    await mgr.open("/b.ts")
    await mgr.open("/c.ts")
    expect(mgr.active()).toBe("/c.ts")
    mgr.close("/c.ts")
    expect(mgr.active()).toBe("/b.ts")
  })

  test("save_without_writer_throws", async () => {
    const mgr = withRoot(() => createBufferManager({ reader: async () => "" }))
    await mgr.open("/a.ts")
    await expect(mgr.save("/a.ts")).rejects.toThrow()
  })
})
