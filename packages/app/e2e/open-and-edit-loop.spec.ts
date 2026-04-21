import { expect, test } from "@playwright/test"
import { getTestWrites, installFakeTauri } from "./fixtures/tmp-workspace"

test("full_loop_open_workspace_edit_save", async ({ page }) => {
  await installFakeTauri(page, {
    dirs: {
      "/ws": [{ name: "hello.ts", path: "/ws/hello.ts", kind: "file" }],
    },
    files: { "/ws/hello.ts": "export const x = 1\n" },
    workspaces: [],
    lastSelectedId: null,
    nextDialogPath: "/ws",
  })

  await page.goto("/")

  // Pick up the empty CTA, then click to open folder. The mocked dialog
  // returns /ws; registerWorkspace returns a new record.
  await page.getByTestId("sidebar-empty-cta").click()

  // After refresh we should see the file tree row for hello.ts.
  await expect(page.getByTestId("file-tree-row-/ws/hello.ts")).toBeVisible()

  // Click the file to open it in the editor pane.
  await page.getByTestId("file-tree-row-/ws/hello.ts").click()

  // Editor pane should show the tab and the editor host.
  await expect(page.getByTestId("editor-tab-/ws/hello.ts")).toBeVisible()
  await expect(page.getByTestId("editor")).toBeVisible()

  // Drive a save through the shortcut bridge. We don't rely on CodeMirror
  // input under happy-dom — the buffer-manager + save path doesn't require
  // actual typing in the editor to exercise the save flow end-to-end; we
  // just need some keyboard input to reach the save handler. Dispatch
  // Cmd+S (or Ctrl+S) at the window.
  const isMac = await page.evaluate(() => navigator.platform.toLowerCase().includes("mac"))
  await page.keyboard.press(`${isMac ? "Meta" : "Control"}+s`)

  // The writer (mocked) records the write and a success toast appears.
  await expect(page.getByTestId("toast-stack").locator("[data-kind='success']")).toBeVisible()

  const writes = await getTestWrites(page)
  expect(writes["/ws/hello.ts"]).toBeDefined()
})

test("save_error_shows_error_toast", async ({ page }) => {
  await installFakeTauri(page, {
    dirs: {
      "/ws": [{ name: "locked.ts", path: "/ws/locked.ts", kind: "file" }],
    },
    files: { "/ws/locked.ts": "content" },
    workspaces: [{ id: "id-1", name: "ws", rootPath: "/ws" }],
    lastSelectedId: "id-1",
  })
  // Override write_text_file to reject
  await page.addInitScript(() => {
    const patched = (cmd: string, args?: Record<string, unknown>) => {
      if (cmd === "write_text_file") {
        return Promise.reject("disk full")
      }
      type Internals = {
        invoke: (c: string, a?: Record<string, unknown>) => Promise<unknown>
      }
      const orig = (window as unknown as { __originalInvoke?: Internals["invoke"] })
        .__originalInvoke
      if (orig) return orig(cmd, args)
      return Promise.reject("no mock")
    }
    const onReady = () => {
      const w = window as unknown as {
        __TAURI_INTERNALS__?: {
          invoke: (c: string, a?: Record<string, unknown>) => Promise<unknown>
        }
        __originalInvoke?: (c: string, a?: Record<string, unknown>) => Promise<unknown>
      }
      if (w.__TAURI_INTERNALS__) {
        w.__originalInvoke = w.__TAURI_INTERNALS__.invoke
        w.__TAURI_INTERNALS__.invoke = patched
      }
    }
    if (document.readyState === "complete") onReady()
    else window.addEventListener("load", onReady)
  })

  await page.goto("/")
  await expect(page.getByTestId("file-tree-row-/ws/locked.ts")).toBeVisible()
  await page.getByTestId("file-tree-row-/ws/locked.ts").click()
  await expect(page.getByTestId("editor-tab-/ws/locked.ts")).toBeVisible()

  const isMac = await page.evaluate(() => navigator.platform.toLowerCase().includes("mac"))
  await page.keyboard.press(`${isMac ? "Meta" : "Control"}+s`)
  await expect(page.getByTestId("toast-stack").locator("[data-kind='error']")).toBeVisible()
})

test("cmd_w_closes_tab_when_clean", async ({ page }) => {
  await installFakeTauri(page, {
    dirs: {
      "/ws": [
        { name: "a.ts", path: "/ws/a.ts", kind: "file" },
        { name: "b.ts", path: "/ws/b.ts", kind: "file" },
      ],
    },
    files: { "/ws/a.ts": "a", "/ws/b.ts": "b" },
    workspaces: [{ id: "id-1", name: "ws", rootPath: "/ws" }],
    lastSelectedId: "id-1",
  })
  await page.goto("/")
  await page.getByTestId("file-tree-row-/ws/a.ts").click()
  await expect(page.getByTestId("editor-tab-/ws/a.ts")).toBeVisible()
  await page.getByTestId("file-tree-row-/ws/b.ts").click()
  await expect(page.getByTestId("editor-tab-/ws/b.ts")).toBeVisible()

  const isMac = await page.evaluate(() => navigator.platform.toLowerCase().includes("mac"))
  await page.keyboard.press(`${isMac ? "Meta" : "Control"}+w`)
  await expect(page.getByTestId("editor-tab-/ws/b.ts")).not.toBeVisible()
})
