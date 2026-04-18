import { cleanup, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { Editor } from "./editor"

afterEach(cleanup)

// CodeMirror 6 is a DOM-imperative library. happy-dom renders the mount
// point but CM6's layout logic doesn't fully activate in a non-browser
// environment — full keyboard/view behavior is covered by the Playwright
// suite (T12). These unit tests assert the wrapping contract only:
// Solid mounts the host div, passes the path through, and cleans up.

describe("Editor (T8, unit)", () => {
  test("mounts_host_element_with_editor_testid", () => {
    const { container } = render(() => <Editor content="hello" />)
    expect(container.querySelector("[data-testid='editor']")).toBeTruthy()
  })

  test("data-editor-path_reflects_path_prop", () => {
    const { container } = render(() => <Editor content="" path="/a/b.json" />)
    const host = container.querySelector("[data-testid='editor']") as HTMLElement
    expect(host.getAttribute("data-editor-path")).toBe("/a/b.json")
  })

  test("host_carries_flex_layout_style_so_it_fills_parent", () => {
    const { container } = render(() => <Editor content="" />)
    const host = container.querySelector("[data-testid='editor']") as HTMLElement
    const style = host.getAttribute("style") ?? ""
    expect(style).toContain("flex")
  })
})
