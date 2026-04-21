import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library"
import { type Component, createSignal } from "solid-js"
import { afterEach, describe, expect, test, vi } from "vitest"
import { useToasts } from "../context/toasts"
import { ToastProvider } from "./toasts"

afterEach(cleanup)

const Consumer: Component<{ onReady: (ctx: ReturnType<typeof useToasts>) => void }> = (props) => {
  const ctx = useToasts()
  props.onReady(ctx)
  return <div data-testid="consumer" />
}

function renderWithToasts() {
  let captured!: ReturnType<typeof useToasts>
  const assign = (c: ReturnType<typeof useToasts>) => {
    captured = c
  }
  const result = render(() => (
    <ToastProvider>
      <Consumer onReady={assign} />
    </ToastProvider>
  ))
  return { ...result, ctx: () => captured }
}

describe("ToastProvider (T9)", () => {
  test("success_auto_dismisses_after_3s", async () => {
    vi.useFakeTimers()
    const { ctx, container } = renderWithToasts()
    ctx().success("saved")
    await waitFor(() => expect(ctx().toasts().length).toBe(1))
    vi.advanceTimersByTime(3100)
    await waitFor(() => expect(ctx().toasts().length).toBe(0))
    vi.useRealTimers()
    expect(container).toBeTruthy()
  })

  test("error_persists_until_dismiss", async () => {
    vi.useFakeTimers()
    const { ctx } = renderWithToasts()
    ctx().error("boom")
    vi.advanceTimersByTime(10_000)
    expect(ctx().toasts().length).toBe(1)
    ctx().dismiss(ctx().toasts()[0]?.id ?? "")
    expect(ctx().toasts().length).toBe(0)
    vi.useRealTimers()
  })

  test("renders_data_kind_on_the_toast_element", async () => {
    const { ctx, container } = renderWithToasts()
    ctx().error("fail", "extra")
    await waitFor(() => expect(container.querySelector("[data-kind='error']")).toBeTruthy())
  })

  test("dismiss_button_clears_the_toast", async () => {
    const { ctx, container } = renderWithToasts()
    const id = ctx().error("x")
    await waitFor(() => expect(container.querySelector(`[data-testid='toast-${id}']`)).toBeTruthy())
    const btn = container.querySelector(`[data-testid='toast-dismiss-${id}']`) as HTMLButtonElement
    fireEvent.click(btn)
    await waitFor(() => expect(ctx().toasts().length).toBe(0))
  })

  test("push_appends_in_order", () => {
    const { ctx } = renderWithToasts()
    ctx().error("a")
    ctx().error("b")
    const msgs = ctx()
      .toasts()
      .map((t) => t.message)
    expect(msgs).toEqual(["a", "b"])
  })

  test("info_success_warn_error_set_kind_correctly", () => {
    const { ctx } = renderWithToasts()
    ctx().info("i")
    ctx().success("s")
    ctx().warn("w")
    ctx().error("e")
    const kinds = ctx()
      .toasts()
      .map((t) => t.kind)
    expect(kinds).toEqual(["info", "success", "warn", "error"])
  })

  test("detail_renders_alongside_message", async () => {
    const { ctx, container } = renderWithToasts()
    ctx().error("main msg", "longer detail here")
    await waitFor(() => expect(container.textContent).toContain("longer detail here"))
    expect(container.textContent).toContain("main msg")
  })

  test("signal_is_reactive", () => {
    const [n, setN] = createSignal(0)
    const { ctx } = renderWithToasts()
    setN(n() + 1)
    ctx().info("x")
    expect(ctx().toasts().length).toBe(1)
  })
})
