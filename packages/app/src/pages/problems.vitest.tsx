import type { Diagnostic } from "@coda/core/problems/panel"
import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { ProblemsPanel } from "./problems"

afterEach(cleanup)

const err: Diagnostic = {
  path: "src/a.ts",
  line: 5,
  column: 2,
  severity: "error",
  message: "missing semicolon",
  source: "tsgo",
}

describe("ProblemsPanel (I2)", () => {
  test("empty state when no diagnostics", () => {
    const { container } = render(() => <ProblemsPanel diagnostics={[]} />)
    expect(container.querySelector("[data-testid='problems-empty']")).toBeTruthy()
  })

  test("renders one entry per diagnostic", () => {
    const { container } = render(() => <ProblemsPanel diagnostics={[err]} />)
    expect(container.querySelector("[data-testid='problem-src/a.ts-5']")).toBeTruthy()
  })

  test("clicking entry calls onJump", () => {
    const calls: string[] = []
    const { container } = render(() => (
      <ProblemsPanel diagnostics={[err]} onJump={(d) => calls.push(d.path)} />
    ))
    const btn = container.querySelector("[data-testid='problem-src/a.ts-5']") as HTMLButtonElement
    fireEvent.click(btn)
    expect(calls).toEqual(["src/a.ts"])
  })
})
