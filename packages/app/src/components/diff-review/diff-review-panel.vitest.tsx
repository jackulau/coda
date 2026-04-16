import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { type DiffHunk, DiffReviewPanel } from "./diff-review-panel"

afterEach(cleanup)

const hunks: DiffHunk[] = [
  {
    file: "src/a.ts",
    header: "@@ -1,3 +1,5 @@",
    lines: ["+ added 1", "+ added 2", "- removed"],
  },
]

describe("DiffReviewPanel (D3)", () => {
  test("renders the empty state when no hunks", () => {
    const { container } = render(() => <DiffReviewPanel hunks={[]} />)
    expect(container.querySelector("[data-testid='diff-review-empty']")).toBeTruthy()
  })

  test("renders one block per hunk", () => {
    const { container } = render(() => <DiffReviewPanel hunks={hunks} />)
    expect(container.querySelector("[data-testid='diff-hunk-src/a.ts']")).toBeTruthy()
  })

  test("clicking the file button fires onJump", () => {
    const calls: string[] = []
    const { container } = render(() => (
      <DiffReviewPanel hunks={hunks} onJump={(f) => calls.push(f)} />
    ))
    const btn = container.querySelector(
      "[data-testid='diff-hunk-src/a.ts'] button",
    ) as HTMLButtonElement
    fireEvent.click(btn)
    expect(calls).toEqual(["src/a.ts"])
  })
})
