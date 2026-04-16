import { cleanup, fireEvent, render } from "@solidjs/testing-library"
import { afterEach, describe, expect, test } from "vitest"
import { FileTreePanel, type FileTreeRow } from "./file-tree"

afterEach(cleanup)

const rows: FileTreeRow[] = [
  { path: "/src", name: "src", kind: "directory", depth: 0 },
  { path: "/src/index.ts", name: "index.ts", kind: "file", depth: 1 },
]

describe("FileTreePanel (D1)", () => {
  test("renders every row", () => {
    const { container } = render(() => <FileTreePanel rows={rows} />)
    expect(container.querySelector("[data-testid='file-tree-row-/src']")).toBeTruthy()
    expect(container.querySelector("[data-testid='file-tree-row-/src/index.ts']")).toBeTruthy()
  })

  test("empty state when no rows", () => {
    const { container } = render(() => <FileTreePanel rows={[]} />)
    expect(container.querySelector("[data-testid='file-tree-empty']")).toBeTruthy()
  })

  test("clicking a file fires onOpen", () => {
    const opens: string[] = []
    const { container } = render(() => <FileTreePanel rows={rows} onOpen={(p) => opens.push(p)} />)
    fireEvent.click(
      container.querySelector("[data-testid='file-tree-row-/src/index.ts']") as HTMLElement,
    )
    expect(opens).toEqual(["/src/index.ts"])
  })
})
