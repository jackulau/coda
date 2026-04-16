import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { AddProjectForm } from "./add-project"

afterEach(cleanup)

describe("AddProjectForm (P1)", () => {
  test("renders name + path inputs and submit button", () => {
    const { container } = render(() => <AddProjectForm />)
    expect(container.querySelector("[data-testid='project-name']")).toBeTruthy()
    expect(container.querySelector("[data-testid='project-root-path']")).toBeTruthy()
    expect(container.querySelector("[data-testid='add-project-submit']")).toBeTruthy()
  })

  test("submit fires onSubmit with typed args", () => {
    const calls: { name: string; rootPath: string }[] = []
    const { container } = render(() => <AddProjectForm onSubmit={(a) => calls.push(a)} />)
    const name = container.querySelector("[data-testid='project-name']") as HTMLInputElement
    const path = container.querySelector("[data-testid='project-root-path']") as HTMLInputElement
    fireEvent.input(name, { target: { value: "My Project" } })
    fireEvent.input(path, { target: { value: "/tmp/mine" } })
    fireEvent.submit(container.querySelector("[data-testid='add-project-form']") as HTMLFormElement)
    expect(calls.length).toBe(1)
    expect(calls[0]).toEqual({ name: "My Project", rootPath: "/tmp/mine" })
  })

  test("submit without values is a no-op", () => {
    const calls: unknown[] = []
    const { container } = render(() => <AddProjectForm onSubmit={(a) => calls.push(a)} />)
    fireEvent.submit(container.querySelector("[data-testid='add-project-form']") as HTMLFormElement)
    expect(calls.length).toBe(0)
  })
})
