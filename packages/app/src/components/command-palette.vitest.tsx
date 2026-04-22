import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library"
import { createSignal } from "solid-js"
import { afterEach, describe, expect, test } from "vitest"
import { CommandPalette, type PaletteCommand } from "./command-palette"

afterEach(cleanup)

const makeCommands = (): PaletteCommand[] => {
  const log: string[] = []
  const commands: PaletteCommand[] = [
    { id: "foo.open", label: "Open Foo", hint: "⌘F", run: () => log.push("foo") },
    { id: "bar.run", label: "Run Bar", hint: "⌘B", run: () => log.push("bar") },
    { id: "zap.close", label: "Close Zap", run: () => log.push("zap") },
  ]
  return commands
}

describe("CommandPalette", () => {
  test("renders nothing when closed", () => {
    const [open] = createSignal(false)
    const { container } = render(() => (
      <CommandPalette commands={makeCommands()} open={open} onClose={() => {}} />
    ))
    expect(container.querySelector("[data-testid='command-palette-overlay']")).toBeNull()
  })

  test("renders overlay + input when open", () => {
    const [open] = createSignal(true)
    const { container } = render(() => (
      <CommandPalette commands={makeCommands()} open={open} onClose={() => {}} />
    ))
    expect(container.querySelector("[data-testid='command-palette-overlay']")).toBeTruthy()
  })

  test("shows commands when > prefix is typed", () => {
    const [open] = createSignal(true)
    render(() => <CommandPalette commands={makeCommands()} open={open} onClose={() => {}} />)
    const input = screen.getByPlaceholderText("Search files by name…") as HTMLInputElement
    fireEvent.input(input, { target: { value: ">bar" } })
    expect(screen.getByText("Run Bar")).toBeTruthy()
    expect(screen.queryByText("Open Foo")).toBeNull()
  })

  test("closes on backdrop click", () => {
    const [open] = createSignal(true)
    let closed = false
    const onClose = () => {
      closed = true
    }
    render(() => <CommandPalette commands={makeCommands()} open={open} onClose={onClose} />)
    const overlay = screen.getByTestId("command-palette-overlay")
    fireEvent.click(overlay)
    expect(closed).toBe(true)
  })

  test("file search mode by default", () => {
    const [open] = createSignal(true)
    render(() => (
      <CommandPalette
        commands={makeCommands()}
        files={["/project/src/main.ts", "/project/src/lib.ts"]}
        open={open}
        onClose={() => {}}
      />
    ))
    const input = screen.getByPlaceholderText("Search files by name…")
    expect(input).toBeTruthy()
  })
})
