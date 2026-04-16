import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { WelcomePage } from "./welcome"

afterEach(cleanup)

describe("WelcomePage (P1)", () => {
  test("renders the welcome heading and both action buttons", () => {
    const { container } = render(() => <WelcomePage />)
    expect(container.textContent).toContain("Welcome to Coda")
    expect(container.querySelector("[data-testid='welcome-add-project']")).toBeTruthy()
    expect(container.querySelector("[data-testid='welcome-skip']")).toBeTruthy()
  })

  test("Add First Project fires onAddProject", () => {
    let called = 0
    const { container } = render(() => <WelcomePage onAddProject={() => called++} />)
    fireEvent.click(
      container.querySelector("[data-testid='welcome-add-project']") as HTMLButtonElement,
    )
    expect(called).toBe(1)
  })

  test("Skip fires onSkip", () => {
    let called = 0
    const { container } = render(() => <WelcomePage onSkip={() => called++} />)
    fireEvent.click(container.querySelector("[data-testid='welcome-skip']") as HTMLButtonElement)
    expect(called).toBe(1)
  })
})
