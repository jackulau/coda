import { cleanup, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test, vi } from "vitest"
import { ResizeHandle } from "./resize-handle"

afterEach(cleanup)

describe("ResizeHandle", () => {
  test("handle renders with cursor + touch-action disabled for drag UX", () => {
    const { getByTestId } = render(() => (
      <ResizeHandle direction="horizontal" onDrag={() => {}} ariaLabel="x" testId="rh" />
    ))
    const handle = getByTestId("rh") as HTMLElement
    expect(handle.style.cursor).toBe("ew-resize")
    expect(handle.style.touchAction).toBe("none")
  })

  test("ArrowRight key nudges by 8px (horizontal)", () => {
    const onDrag = vi.fn()
    const onNudge = vi.fn()
    const { getByTestId } = render(() => (
      <ResizeHandle
        direction="horizontal"
        onDrag={onDrag}
        onNudge={onNudge}
        ariaLabel="resize"
        testId="rh"
      />
    ))
    const handle = getByTestId("rh") as HTMLElement
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }))
    expect(onNudge).toHaveBeenCalledWith(8)
  })

  test("Shift+ArrowDown nudges by 32px (vertical)", () => {
    const onDrag = vi.fn()
    const { getByTestId } = render(() => (
      <ResizeHandle direction="vertical" onDrag={onDrag} ariaLabel="resize" testId="rh" />
    ))
    const handle = getByTestId("rh") as HTMLElement
    handle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true, bubbles: true }),
    )
    expect(onDrag).toHaveBeenCalledWith(32)
  })

  test("aria attributes flip with direction", () => {
    const { getByTestId } = render(() => (
      <ResizeHandle direction="vertical" onDrag={() => {}} ariaLabel="resize" testId="rh" />
    ))
    const handle = getByTestId("rh") as HTMLElement
    expect(handle.getAttribute("role")).toBe("separator")
    expect(handle.getAttribute("aria-orientation")).toBe("horizontal")
    expect(handle.getAttribute("aria-label")).toBe("resize")
  })
})
