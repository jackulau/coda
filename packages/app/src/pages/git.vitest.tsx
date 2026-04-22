import { cleanup, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import type { ChangedFile } from "../lib/ipc"
import { GitPanel } from "./git"

afterEach(cleanup)

const file: ChangedFile = {
  path: "src/a.ts",
  kind: "modify",
  additions: 3,
  deletions: 1,
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

  test("renders one row per changed file", () => {
    const { container } = render(() => <GitPanel files={[file]} />)
    expect(container.querySelector("[data-testid='git-file-src/a.ts']")).toBeTruthy()
  })
})
