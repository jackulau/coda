import { cleanup, render, waitFor } from "@solidjs/testing-library"
import { type Component, createSignal } from "solid-js"
import { afterEach, describe, expect, test, vi } from "vitest"
import type { WorkspaceRecord } from "../lib/ipc"
import { WorkspaceProvider, useWorkspaces } from "./workspace"

afterEach(cleanup)

function makeRecords(n: number): WorkspaceRecord[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    name: `ws-${i}`,
    rootPath: `/tmp/ws-${i}`,
    addedAt: "1700000000",
  }))
}

const Consumer: Component<{ onReady: (ws: ReturnType<typeof useWorkspaces>) => void }> = (
  props,
) => {
  const ws = useWorkspaces()
  props.onReady(ws)
  return <div data-testid="consumer" />
}

function renderWithStubs(
  stubs: Parameters<typeof WorkspaceProvider>[0]["ipc"],
  onReady?: (ws: ReturnType<typeof useWorkspaces>) => void,
) {
  let captured!: ReturnType<typeof useWorkspaces>
  const result = render(() => (
    <WorkspaceProvider ipc={stubs}>
      <Consumer
        onReady={(ws) => {
          captured = ws
          onReady?.(ws)
        }}
      />
    </WorkspaceProvider>
  ))
  // biome-ignore lint/suspicious/noExplicitAny: trivial typing workaround
  return { ...result, ws: () => captured as any }
}

describe("WorkspaceProvider (T6)", () => {
  test("provider_loads_from_ipc_on_mount", async () => {
    const records = makeRecords(2)
    const { ws } = renderWithStubs({
      listWorkspaces: vi.fn().mockResolvedValue(records),
      getLastSelectedWorkspace: vi.fn().mockResolvedValue(null),
    })
    await waitFor(() => expect(ws().workspaces().length).toBe(2))
    expect(ws().projects().length).toBe(2)
    // selection defaults to first
    expect(ws().selectedId()).toBe("id-0")
  })

  test("selects_last_from_ipc_if_still_present", async () => {
    const records = makeRecords(3)
    const { ws } = renderWithStubs({
      listWorkspaces: vi.fn().mockResolvedValue(records),
      getLastSelectedWorkspace: vi.fn().mockResolvedValue("id-2"),
    })
    await waitFor(() => expect(ws().selectedId()).toBe("id-2"))
  })

  test("falls_back_to_first_when_last_selected_no_longer_exists", async () => {
    const records = makeRecords(2)
    const { ws } = renderWithStubs({
      listWorkspaces: vi.fn().mockResolvedValue(records),
      getLastSelectedWorkspace: vi.fn().mockResolvedValue("deleted-id"),
    })
    await waitFor(() => expect(ws().selectedId()).toBe("id-0"))
  })

  test("addWorkspaceFromDialog_happy_path", async () => {
    const [records, setRecords] = createSignal<WorkspaceRecord[]>([])
    const list = vi.fn().mockImplementation(async () => records())
    const register = vi.fn().mockImplementation(async (root: string) => {
      const rec: WorkspaceRecord = {
        id: "new-1",
        name: "picked",
        rootPath: root,
        addedAt: "t",
      }
      setRecords([...records(), rec])
      return rec
    })
    const dialog = vi.fn().mockResolvedValue("/picked/path")
    const setLast = vi.fn().mockResolvedValue(undefined)
    const { ws } = renderWithStubs({
      listWorkspaces: list,
      registerWorkspace: register,
      openFolderDialog: dialog,
      getLastSelectedWorkspace: vi.fn().mockResolvedValue(null),
      setLastSelectedWorkspace: setLast,
    })
    await waitFor(() => expect(ws().workspaces().length).toBe(0))

    const rec = await ws().addWorkspaceFromDialog()
    expect(rec?.rootPath).toBe("/picked/path")
    expect(register).toHaveBeenCalledWith("/picked/path")
    await waitFor(() => expect(ws().workspaces().length).toBe(1))
    expect(ws().selectedId()).toBe("new-1")
    expect(setLast).toHaveBeenCalledWith("new-1")
  })

  test("addWorkspaceFromDialog_canceled", async () => {
    const register = vi.fn()
    const dialog = vi.fn().mockResolvedValue(null)
    const { ws } = renderWithStubs({
      listWorkspaces: vi.fn().mockResolvedValue([]),
      registerWorkspace: register,
      openFolderDialog: dialog,
      getLastSelectedWorkspace: vi.fn().mockResolvedValue(null),
    })
    await waitFor(() => expect(ws().isLoading()).toBe(false))
    const rec = await ws().addWorkspaceFromDialog()
    expect(rec).toBeNull()
    expect(register).not.toHaveBeenCalled()
  })

  test("removeWorkspace_refreshes_list", async () => {
    const recordStore = makeRecords(2)
    const list = vi.fn().mockImplementation(async () => recordStore.slice())
    const unregister = vi.fn().mockImplementation(async (id: string) => {
      const i = recordStore.findIndex((r) => r.id === id)
      if (i >= 0) recordStore.splice(i, 1)
    })
    const { ws } = renderWithStubs({
      listWorkspaces: list,
      unregisterWorkspace: unregister,
      getLastSelectedWorkspace: vi.fn().mockResolvedValue(null),
    })
    await waitFor(() => expect(ws().workspaces().length).toBe(2))
    await ws().removeWorkspace("id-0")
    await waitFor(() => expect(ws().workspaces().length).toBe(1))
    expect(unregister).toHaveBeenCalledWith("id-0")
  })

  test("load_error_surfaces", async () => {
    const { ws } = renderWithStubs({
      listWorkspaces: vi.fn().mockRejectedValue(new Error("pipe closed")),
    })
    await waitFor(() => expect(ws().loadError()).toBe("pipe closed"))
  })

  test("selectWorkspace_persists_via_ipc", async () => {
    const setLast = vi.fn().mockResolvedValue(undefined)
    const { ws } = renderWithStubs({
      listWorkspaces: vi.fn().mockResolvedValue(makeRecords(2)),
      getLastSelectedWorkspace: vi.fn().mockResolvedValue(null),
      setLastSelectedWorkspace: setLast,
    })
    await waitFor(() => expect(ws().workspaces().length).toBe(2))
    ws().selectWorkspace("id-1")
    expect(setLast).toHaveBeenCalledWith("id-1")
  })
})
