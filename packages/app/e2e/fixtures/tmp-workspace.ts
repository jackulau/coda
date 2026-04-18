// Test harness for Playwright e2e: installs a fake Tauri IPC bridge and
// a fake plugin-dialog / plugin-opener / plugin-fs into the page before
// app code runs. Each spec picks a small in-memory filesystem shape.

import type { Page } from "@playwright/test"

export interface FakeEntry {
  name: string
  path: string
  kind: "file" | "directory"
}

export interface FakeFs {
  /** Directory listings keyed by absolute directory path. */
  dirs: Record<string, FakeEntry[]>
  /** File contents keyed by absolute file path. */
  files: Record<string, string>
  /** Value the next open-folder dialog should return ("null" to cancel). */
  nextDialogPath?: string | null
  /** IDs the workspaces registry should contain on startup. */
  workspaces?: Array<{ id: string; name: string; rootPath: string }>
  lastSelectedId?: string | null
}

export async function installFakeTauri(page: Page, fs: FakeFs): Promise<void> {
  await page.addInitScript((fsJson) => {
    const tfs: FakeFs = JSON.parse(fsJson)
    type Cmd = string
    const writes: Record<string, string> = {}
    const workspaces = (tfs.workspaces ?? []).slice()
    let lastSelectedId = tfs.lastSelectedId ?? null

    function ok<T>(v: T): Promise<T> {
      return Promise.resolve(v)
    }
    function fail(msg: string): Promise<never> {
      return Promise.reject(msg)
    }

    const handlers: Record<Cmd, (args: Record<string, unknown>) => Promise<unknown>> = {
      list_directory: async (args) => {
        const dir = String(args.path)
        const entries = tfs.dirs[dir]
        if (!entries) return fail(`no mock dir ${dir}`)
        return ok(entries)
      },
      read_text_file: async (args) => {
        const p = String(args.path)
        if (p in writes) return ok(writes[p])
        if (p in tfs.files) return ok(tfs.files[p])
        return fail(`no such file ${p}`)
      },
      write_text_file: async (args) => {
        const p = String(args.path)
        const contents = String(args.contents)
        writes[p] = contents
        tfs.files[p] = contents
        return ok(undefined)
      },
      list_workspaces: async () => ok(workspaces),
      register_workspace: async (args) => {
        const root = String(args.rootPath)
        const existing = workspaces.find((w) => w.rootPath === root)
        if (existing) return ok(existing)
        const rec = {
          id: `id-${workspaces.length + 1}`,
          name: args.name ? String(args.name) : root.split("/").pop() || root,
          rootPath: root,
          addedAt: String(Date.now()),
        }
        workspaces.push(rec)
        return ok(rec)
      },
      unregister_workspace: async (args) => {
        const id = String(args.id)
        const i = workspaces.findIndex((w) => w.id === id)
        if (i >= 0) workspaces.splice(i, 1)
        if (lastSelectedId === id) lastSelectedId = null
        return ok(undefined)
      },
      get_last_selected_workspace: async () => ok(lastSelectedId),
      set_last_selected_workspace: async (args) => {
        lastSelectedId = String(args.id)
        return ok(undefined)
      },
      "plugin:dialog|open": async () => {
        const p = tfs.nextDialogPath
        if (p === undefined) return ok(null)
        return ok(p)
      },
      "plugin:opener|reveal_item_in_dir": async () => ok(undefined),
    }

    type Internals = {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
    }
    const internals: Internals = {
      invoke: (cmd, args) => {
        const fn = handlers[cmd]
        if (!fn) return Promise.reject(`no mock for ${cmd}`)
        return fn(args ?? {})
      },
    }
    // Tauri v2 uses window.__TAURI_INTERNALS__.
    ;(window as unknown as { __TAURI_INTERNALS__: Internals }).__TAURI_INTERNALS__ = internals
    // Expose for test assertions on what was written.
    ;(window as unknown as { __testWrites: Record<string, string> }).__testWrites = writes
  }, JSON.stringify(fs))
}

export async function getTestWrites(page: Page): Promise<Record<string, string>> {
  return page.evaluate(
    () => (window as unknown as { __testWrites: Record<string, string> }).__testWrites,
  )
}
