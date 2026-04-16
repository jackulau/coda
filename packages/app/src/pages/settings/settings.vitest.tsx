import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { SettingsPage } from "./settings"

afterEach(cleanup)

describe("SettingsPage (P2)", () => {
  test("save button fires onSavePat with the typed token", () => {
    const saved: string[] = []
    const { container } = render(() => <SettingsPage onSavePat={(t) => saved.push(t)} />)
    const input = container.querySelector("[data-testid='settings-pat-input']") as HTMLInputElement
    fireEvent.input(input, { target: { value: "ghp_xxxxxx" } })
    fireEvent.click(
      container.querySelector("[data-testid='settings-save-pat']") as HTMLButtonElement,
    )
    expect(saved).toEqual(["ghp_xxxxxx"])
  })

  test("PAT input is type=password", () => {
    const { container } = render(() => <SettingsPage />)
    const input = container.querySelector("[data-testid='settings-pat-input']") as HTMLInputElement
    expect(input.type).toBe("password")
  })
})
