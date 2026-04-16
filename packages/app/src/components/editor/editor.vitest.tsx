import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { Editor } from "./editor"

afterEach(cleanup)

describe("Editor (D2)", () => {
  test("renders a textarea with the initial content", () => {
    const { container } = render(() => <Editor initial="hello" />)
    const ta = container.querySelector("[data-testid='editor-textarea']") as HTMLTextAreaElement
    expect(ta.value).toBe("hello")
  })

  test("onChange fires with new value on input", () => {
    const seen: string[] = []
    const { container } = render(() => <Editor onChange={(v) => seen.push(v)} />)
    const ta = container.querySelector("[data-testid='editor-textarea']") as HTMLTextAreaElement
    fireEvent.input(ta, { target: { value: "goodbye" } })
    expect(seen[seen.length - 1]).toBe("goodbye")
  })

  test("line count updates with content", () => {
    const { container } = render(() => <Editor initial={"line1\nline2\nline3"} />)
    expect(container.querySelector("[data-testid='editor-line-count']")?.textContent).toBe("3")
  })
})
