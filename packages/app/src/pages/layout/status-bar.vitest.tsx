import { cleanup, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { StatusBar } from "./status-bar"

afterEach(cleanup)

describe("StatusBar (U4)", () => {
  test("renders branch + agent status + diff counts when provided", () => {
    const { container } = render(() => (
      <StatusBar
        branch="feat/x"
        agentStatus="running"
        diffCounts={{ additions: 12, deletions: 3 }}
      />
    ))
    expect(container.querySelector("[data-testid='status-branch']")?.textContent).toBe("feat/x")
    expect(container.querySelector("[data-testid='status-agent']")?.textContent).toBe("running")
    expect(container.querySelector("[data-testid='status-diff']")?.textContent).toBe("+12 −3")
  })

  test("renders only the passed sections", () => {
    const { container } = render(() => <StatusBar branch="main" />)
    expect(container.querySelector("[data-testid='status-branch']")).toBeTruthy()
    expect(container.querySelector("[data-testid='status-agent']")).toBeFalsy()
  })
})
