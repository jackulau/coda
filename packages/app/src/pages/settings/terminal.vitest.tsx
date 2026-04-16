import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { TerminalSettingsPage } from "./terminal"

afterEach(cleanup)

describe("TerminalSettingsPage (C5)", () => {
  test("renders defaults", () => {
    const { container } = render(() => <TerminalSettingsPage />)
    const font = container.querySelector("[data-testid='terminal-font-size']") as HTMLInputElement
    expect(font.value).toBe("14")
    expect(container.querySelector("[data-testid='terminal-cursor-style']")?.textContent).toBe(
      "bar",
    )
    expect(container.querySelector("[data-testid='terminal-scrollback']")?.textContent).toBe(
      "10000",
    )
  })

  test("changing font size fires onChange with the new value", () => {
    const events: number[] = []
    const { container } = render(() => (
      <TerminalSettingsPage onChange={(s) => events.push(s.fontSize)} />
    ))
    const input = container.querySelector("[data-testid='terminal-font-size']") as HTMLInputElement
    fireEvent.input(input, { target: { value: "18" } })
    expect(events[events.length - 1]).toBe(18)
  })
})
