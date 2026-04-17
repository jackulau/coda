import { cleanup, fireEvent, render, waitFor } from "@solidjs/testing-library"
import { afterEach, describe, expect, test, vi } from "vitest"
import type { DirEntry } from "../../lib/ipc"
import { FileTreeLive, FileTreePanel, type FileTreeRow } from "./file-tree"

afterEach(cleanup)

const rows: FileTreeRow[] = [
  { path: "/src", name: "src", kind: "directory", depth: 0 },
  { path: "/src/index.ts", name: "index.ts", kind: "file", depth: 1 },
]

describe("FileTreePanel (D1, controlled)", () => {
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

/* ------------------------------------------------------------------ */
/* FileTreeLive — T7 live mode                                        */
/* ------------------------------------------------------------------ */

function makeList(
  byPath: Record<string, DirEntry[] | Error>,
): (path: string) => Promise<DirEntry[]> {
  return vi.fn().mockImplementation(async (p: string) => {
    const r = byPath[p]
    if (!r) throw new Error(`no mock for ${p}`)
    if (r instanceof Error) throw r
    return r
  })
}

describe("FileTreeLive (T7)", () => {
  test("initial_load_calls_listDirectory_once", async () => {
    const list = makeList({
      "/w": [{ name: "a.txt", path: "/w/a.txt", kind: "file" }],
    })
    const { container } = render(() => <FileTreeLive rootPath="/w" listDirectory={list} />)
    await waitFor(() =>
      expect(container.querySelector("[data-testid='file-tree-row-/w/a.txt']")).toBeTruthy(),
    )
    expect((list as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1)
  })

  test("expand_triggers_children_fetch", async () => {
    const list = makeList({
      "/w": [{ name: "sub", path: "/w/sub", kind: "directory" }],
      "/w/sub": [{ name: "f.txt", path: "/w/sub/f.txt", kind: "file" }],
    })
    const { container } = render(() => <FileTreeLive rootPath="/w" listDirectory={list} />)
    await waitFor(() =>
      expect(container.querySelector("[data-testid='file-tree-row-/w/sub']")).toBeTruthy(),
    )
    fireEvent.click(container.querySelector("[data-testid='file-tree-row-/w/sub']") as HTMLElement)
    await waitFor(() =>
      expect(container.querySelector("[data-testid='file-tree-row-/w/sub/f.txt']")).toBeTruthy(),
    )
  })

  test("collapse_does_not_refetch", async () => {
    const list = makeList({
      "/w": [{ name: "sub", path: "/w/sub", kind: "directory" }],
      "/w/sub": [{ name: "f.txt", path: "/w/sub/f.txt", kind: "file" }],
    })
    const { container } = render(() => <FileTreeLive rootPath="/w" listDirectory={list} />)
    const getSub = () =>
      container.querySelector("[data-testid='file-tree-row-/w/sub']") as HTMLElement | null
    await waitFor(() => expect(getSub()).toBeTruthy())
    fireEvent.click(getSub() as HTMLElement)
    await waitFor(() =>
      expect(container.querySelector("[data-testid='file-tree-row-/w/sub/f.txt']")).toBeTruthy(),
    )
    fireEvent.click(getSub() as HTMLElement) // collapse — query fresh
    await waitFor(() =>
      expect(container.querySelector("[data-testid='file-tree-row-/w/sub/f.txt']")).toBeNull(),
    )
    fireEvent.click(getSub() as HTMLElement) // re-expand
    await waitFor(() =>
      expect(container.querySelector("[data-testid='file-tree-row-/w/sub/f.txt']")).toBeTruthy(),
    )
    // list /w/sub should have been called exactly once
    const calls = (list as unknown as { mock: { calls: unknown[][] } }).mock.calls
    const subCalls = calls.filter((c) => c[0] === "/w/sub")
    expect(subCalls.length).toBe(1)
  })

  test("error_row_shown_on_eacces", async () => {
    const list = makeList({
      "/w": [{ name: "denied", path: "/w/denied", kind: "directory" }],
      "/w/denied": new Error("permission denied"),
    })
    const { container } = render(() => <FileTreeLive rootPath="/w" listDirectory={list} />)
    await waitFor(() =>
      expect(container.querySelector("[data-testid='file-tree-row-/w/denied']")).toBeTruthy(),
    )
    fireEvent.click(
      container.querySelector("[data-testid='file-tree-row-/w/denied']") as HTMLElement,
    )
    await waitFor(() => {
      const allRows = container.querySelectorAll("[data-error='true']")
      expect(allRows.length).toBeGreaterThan(0)
    })
  })

  test("keyboard_arrow_down_moves_focus", async () => {
    const list = makeList({
      "/w": [
        { name: "a", path: "/w/a", kind: "file" },
        { name: "b", path: "/w/b", kind: "file" },
      ],
    })
    const { container } = render(() => <FileTreeLive rootPath="/w" listDirectory={list} />)
    await waitFor(() =>
      expect(container.querySelector("[data-testid='file-tree-row-/w/a']")).toBeTruthy(),
    )
    const first = container.querySelector("[data-testid='file-tree-row-/w/a']") as HTMLElement
    first.focus()
    fireEvent.keyDown(first, { key: "ArrowDown" })
    await waitFor(() => {
      const focusedB = container.querySelector(
        "[data-testid='file-tree-row-/w/b'][data-focused='true']",
      )
      expect(focusedB).toBeTruthy()
    })
  })

  test("keyboard_right_on_dir_expands", async () => {
    const list = makeList({
      "/w": [{ name: "sub", path: "/w/sub", kind: "directory" }],
      "/w/sub": [{ name: "f.txt", path: "/w/sub/f.txt", kind: "file" }],
    })
    const { container } = render(() => <FileTreeLive rootPath="/w" listDirectory={list} />)
    await waitFor(() =>
      expect(container.querySelector("[data-testid='file-tree-row-/w/sub']")).toBeTruthy(),
    )
    const sub = container.querySelector("[data-testid='file-tree-row-/w/sub']") as HTMLElement
    sub.focus()
    fireEvent.keyDown(sub, { key: "ArrowRight" })
    await waitFor(() =>
      expect(container.querySelector("[data-testid='file-tree-row-/w/sub/f.txt']")).toBeTruthy(),
    )
  })

  test("refresh_clears_cache", async () => {
    const list = makeList({
      "/w": [{ name: "a", path: "/w/a", kind: "file" }],
    })
    const { container } = render(() => <FileTreeLive rootPath="/w" listDirectory={list} />)
    await waitFor(() =>
      expect(container.querySelector("[data-testid='file-tree-row-/w/a']")).toBeTruthy(),
    )
    const before = (list as unknown as { mock: { calls: unknown[] } }).mock.calls.length
    fireEvent.click(container.querySelector("[data-testid='file-tree-refresh']") as HTMLElement)
    await waitFor(() => {
      const after = (list as unknown as { mock: { calls: unknown[] } }).mock.calls.length
      expect(after).toBeGreaterThan(before)
    })
  })

  test("file_click_fires_onOpenFile", async () => {
    const list = makeList({
      "/w": [{ name: "a.txt", path: "/w/a.txt", kind: "file" }],
    })
    const opens: string[] = []
    const { container } = render(() => (
      <FileTreeLive rootPath="/w" listDirectory={list} onOpenFile={(p) => opens.push(p)} />
    ))
    await waitFor(() =>
      expect(container.querySelector("[data-testid='file-tree-row-/w/a.txt']")).toBeTruthy(),
    )
    fireEvent.click(
      container.querySelector("[data-testid='file-tree-row-/w/a.txt']") as HTMLElement,
    )
    expect(opens).toEqual(["/w/a.txt"])
  })
})
