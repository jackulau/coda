import { cleanup, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { SearchPage } from "./search"

afterEach(cleanup)

describe("SearchPage (D7)", () => {
  test("renders search page with input", () => {
    const { container } = render(() => <SearchPage />)
    expect(container.querySelector("[data-testid='search-page']")).toBeTruthy()
    expect(container.querySelector("[data-testid='search-input']")).toBeTruthy()
  })

  test("shows empty prompt when no query", () => {
    const { container } = render(() => <SearchPage />)
    const page = container.querySelector("[data-testid='search-page']")
    expect(page?.textContent).toContain("Type to search")
  })
})
