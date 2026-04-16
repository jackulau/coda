import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { type SearchHit, SearchPage } from "./search"

afterEach(cleanup)

describe("SearchPage (D7)", () => {
  test("empty state when no hits", () => {
    const { container } = render(() => <SearchPage />)
    expect(container.querySelector("[data-testid='search-empty']")).toBeTruthy()
  })

  test("typing + go invokes onSearch and renders the result rows", async () => {
    const calls: string[] = []
    const hits: SearchHit[] = [{ file: "src/a.ts", line: 12, preview: "some match" }]
    const { container } = render(() => (
      <SearchPage
        onSearch={async (q) => {
          calls.push(q)
          return hits
        }}
      />
    ))
    const input = container.querySelector("[data-testid='search-input']") as HTMLInputElement
    fireEvent.input(input, { target: { value: "some" } })
    fireEvent.click(container.querySelector("[data-testid='search-go']") as HTMLButtonElement)
    await waitFor(() =>
      expect(container.querySelector("[data-testid='search-hit-src/a.ts-12']")).toBeTruthy(),
    )
    expect(calls).toEqual(["some"])
  })
})
