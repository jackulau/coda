import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { ProjectContextMenu } from "./sidebar-project-context"

afterEach(cleanup)

describe("ProjectContextMenu (P3)", () => {
  test("renders the four default actions", () => {
    const { container } = render(() => <ProjectContextMenu />)
    expect(container.querySelector("[data-testid='project-ctx-rename']")).toBeTruthy()
    expect(container.querySelector("[data-testid='project-ctx-remove']")).toBeTruthy()
    expect(container.querySelector("[data-testid='project-ctx-reveal']")).toBeTruthy()
    expect(container.querySelector("[data-testid='project-ctx-clone-as-worktree']")).toBeTruthy()
  })

  test("selecting an action fires onSelect with its id", () => {
    const seen: string[] = []
    const { container } = render(() => <ProjectContextMenu onSelect={(id) => seen.push(id)} />)
    fireEvent.click(
      container.querySelector("[data-testid='project-ctx-rename'] button") as HTMLButtonElement,
    )
    fireEvent.click(
      container.querySelector("[data-testid='project-ctx-remove'] button") as HTMLButtonElement,
    )
    expect(seen).toEqual(["rename", "remove"])
  })
})
