import type { PrView } from "@coda/core/github"
import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { PrReviewPanel } from "./pr-review"

afterEach(cleanup)

const samplePr: PrView = {
  number: 42,
  state: "open",
  title: "A nice fix",
  headSha: "abc1234",
  baseSha: "def5678",
  author: "jack",
  files: [{ path: "a.ts", status: "modified", additions: 10, deletions: 2, patch: null }],
}

describe("PrReviewPanel (E1, E2)", () => {
  test("renders with a PR passed directly", () => {
    const { container } = render(() => <PrReviewPanel pr={samplePr} />)
    expect(container.querySelector("[data-testid='pr-review-title']")?.textContent).toBe(
      "A nice fix",
    )
    expect(container.querySelector("[data-testid='pr-review-state']")?.textContent).toBe("open")
  })

  test("approve button fires onApprove", () => {
    let called = 0
    const { container } = render(() => <PrReviewPanel pr={samplePr} onApprove={() => called++} />)
    const btn = container.querySelector("[data-testid='pr-review-approve']") as HTMLButtonElement
    fireEvent.click(btn)
    expect(called).toBe(1)
  })
})
