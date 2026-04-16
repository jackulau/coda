import type { GitFileStatus } from "@coda/core/git/status"
import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { GitPanel } from "./git"

afterEach(cleanup)

const file: GitFileStatus = {
  path: "src/a.ts",
  index: "unmodified",
  worktree: "modified",
  conflict: false,
}

describe("GitPanel (I3)", () => {
  test("shows branch when provided", () => {
    const { container } = render(() => <GitPanel files={[]} branch="main" />)
    expect(container.querySelector("[data-testid='git-branch']")?.textContent).toBe("main")
  })

  test("clean state when no file changes", () => {
    const { container } = render(() => <GitPanel files={[]} />)
    expect(container.querySelector("[data-testid='git-clean']")).toBeTruthy()
  })

  test("renders one row per changed file + stage button fires onStage", () => {
    const staged: string[] = []
    const { container } = render(() => <GitPanel files={[file]} onStage={(p) => staged.push(p)} />)
    expect(container.querySelector("[data-testid='git-file-src/a.ts']")).toBeTruthy()
    const btn = container.querySelector(
      "[data-testid='git-file-src/a.ts'] button",
    ) as HTMLButtonElement
    fireEvent.click(btn)
    expect(staged).toEqual(["src/a.ts"])
  })
})
