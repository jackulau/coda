import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test, vi } from "vitest"
import type { Buffer } from "./buffer-manager"
import { Tabs } from "./tabs"

afterEach(cleanup)

function makeBuf(path: string, dirty = false): Buffer {
  return { path, original: "", content: "", dirty, version: 1 }
}

describe("Tabs (T8)", () => {
  test("renders_one_tab_per_open_buffer", () => {
    const buffers = [makeBuf("/a.ts"), makeBuf("/b.ts"), makeBuf("/c.ts")]
    const { container } = render(() => (
      <Tabs buffers={buffers} activePath="/a.ts" onFocus={() => {}} onClose={() => {}} />
    ))
    expect(container.querySelectorAll("[data-testid^='editor-tab-/']").length).toBe(3)
  })

  test("active_tab_has_data_active_true", () => {
    const { container } = render(() => (
      <Tabs
        buffers={[makeBuf("/a.ts"), makeBuf("/b.ts")]}
        activePath="/b.ts"
        onFocus={() => {}}
        onClose={() => {}}
      />
    ))
    const b = container.querySelector("[data-testid='editor-tab-/b.ts']")
    expect(b?.getAttribute("data-active")).toBe("true")
    const a = container.querySelector("[data-testid='editor-tab-/a.ts']")
    expect(a?.getAttribute("data-active")).toBe("false")
  })

  test("dirty_buffer_shows_dot_and_attr", () => {
    const { container } = render(() => (
      <Tabs
        buffers={[makeBuf("/a.ts", true)]}
        activePath="/a.ts"
        onFocus={() => {}}
        onClose={() => {}}
      />
    ))
    expect(container.querySelector("[data-testid='editor-tab-dirty-/a.ts']")).toBeTruthy()
    expect(
      container.querySelector("[data-testid='editor-tab-/a.ts']")?.getAttribute("data-dirty"),
    ).toBe("true")
  })

  test("click_tab_fires_onFocus_with_path", () => {
    const onFocus = vi.fn()
    const { container } = render(() => (
      <Tabs
        buffers={[makeBuf("/a.ts"), makeBuf("/b.ts")]}
        activePath="/a.ts"
        onFocus={onFocus}
        onClose={() => {}}
      />
    ))
    fireEvent.click(container.querySelector("[data-testid='editor-tab-/b.ts']") as HTMLElement)
    expect(onFocus).toHaveBeenCalledWith("/b.ts")
  })

  test("click_close_fires_onClose_and_stops_focus", () => {
    const onFocus = vi.fn()
    const onClose = vi.fn()
    const { container } = render(() => (
      <Tabs buffers={[makeBuf("/a.ts")]} activePath="/a.ts" onFocus={onFocus} onClose={onClose} />
    ))
    fireEvent.click(
      container.querySelector("[data-testid='editor-tab-close-/a.ts']") as HTMLElement,
    )
    expect(onClose).toHaveBeenCalledWith("/a.ts")
    expect(onFocus).not.toHaveBeenCalled()
  })
})
