import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { UpdatesPage } from "./updates"

afterEach(cleanup)

describe("UpdatesPage (X2)", () => {
  test("renders current version + channel buttons", () => {
    const { container } = render(() => (
      <UpdatesPage currentVersion="2.0.0-alpha.0" channel="stable" />
    ))
    expect(container.querySelector("[data-testid='current-version']")?.textContent).toBe(
      "2.0.0-alpha.0",
    )
    expect(
      container.querySelector("[data-testid='channel-select']")?.getAttribute("data-value"),
    ).toBe("stable")
    expect(
      container.querySelector("[data-testid='channel-stable']")?.getAttribute("data-active"),
    ).toBe("true")
  })

  test("clicking 'Check for updates' fires onCheckNow", () => {
    let called = 0
    const { container } = render(() => (
      <UpdatesPage currentVersion="2.0.0" channel="stable" onCheckNow={() => called++} />
    ))
    fireEvent.click(container.querySelector("[data-testid='check-now']") as HTMLButtonElement)
    expect(called).toBe(1)
  })
})
