import { promises as fs } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, test, vi } from "vitest"
import { isAppError } from "../components/error-normalize"
import {
  __resetIpcInvoke,
  __setIpcInvoke,
  getLastSelectedWorkspace,
  listDirectory,
  listWorkspaces,
  openFolderDialog,
  readTextFile,
  registerWorkspace,
  revealInFinder,
  setLastSelectedWorkspace,
  unregisterWorkspace,
  writeTextFile,
} from "./ipc"

afterEach(() => __resetIpcInvoke())

describe("ipc typed wrapper", () => {
  test("listDirectory forwards path argument", async () => {
    const spy = vi.fn().mockResolvedValue([{ name: "a", path: "/x/a", kind: "file" }])
    __setIpcInvoke(spy as never)
    const out = await listDirectory("/x")
    expect(spy).toHaveBeenCalledWith("list_directory", { path: "/x" })
    expect(out[0]?.name).toBe("a")
  })

  test("readTextFile returns string", async () => {
    __setIpcInvoke(vi.fn().mockResolvedValue("hello") as never)
    await expect(readTextFile("/x/y.txt")).resolves.toBe("hello")
  })

  test("writeTextFile forwards path and contents", async () => {
    const spy = vi.fn().mockResolvedValue(undefined)
    __setIpcInvoke(spy as never)
    await writeTextFile("/x/y.txt", "body")
    expect(spy).toHaveBeenCalledWith("write_text_file", {
      path: "/x/y.txt",
      contents: "body",
    })
  })

  test("string rejection normalizes to AppError with source + message", async () => {
    __setIpcInvoke(vi.fn().mockRejectedValue("boom from rust") as never)
    try {
      await listDirectory("/x")
      throw new Error("should have rejected")
    } catch (err) {
      expect(isAppError(err)).toBe(true)
      if (isAppError(err)) {
        expect(err.message).toBe("boom from rust")
        expect(err.source).toBe("list_directory")
      }
    }
  })

  test("Error instance rejection keeps message and stack", async () => {
    const inner = new Error("oops")
    __setIpcInvoke(vi.fn().mockRejectedValue(inner) as never)
    try {
      await readTextFile("/x/y.txt")
      throw new Error("should have rejected")
    } catch (err) {
      expect(isAppError(err)).toBe(true)
      if (isAppError(err)) {
        expect(err.message).toBe("oops")
        expect(typeof err.detail === "string" || err.detail === undefined).toBe(true)
      }
    }
  })

  test("listWorkspaces returns records", async () => {
    const rec = [{ id: "a", name: "ws", rootPath: "/x", addedAt: "t" }]
    __setIpcInvoke(vi.fn().mockResolvedValue(rec) as never)
    await expect(listWorkspaces()).resolves.toEqual(rec)
  })

  test("registerWorkspace sends rootPath and optional name", async () => {
    const spy = vi.fn().mockResolvedValue({
      id: "new",
      name: "ws",
      rootPath: "/x",
      addedAt: "t",
    })
    __setIpcInvoke(spy as never)
    await registerWorkspace("/x", "ws")
    expect(spy).toHaveBeenCalledWith("register_workspace", {
      rootPath: "/x",
      name: "ws",
    })
  })

  test("unregisterWorkspace forwards id", async () => {
    const spy = vi.fn().mockResolvedValue(undefined)
    __setIpcInvoke(spy as never)
    await unregisterWorkspace("id-1")
    expect(spy).toHaveBeenCalledWith("unregister_workspace", { id: "id-1" })
  })

  test("getLastSelectedWorkspace returns null when none", async () => {
    __setIpcInvoke(vi.fn().mockResolvedValue(null) as never)
    await expect(getLastSelectedWorkspace()).resolves.toBeNull()
  })

  test("setLastSelectedWorkspace forwards id", async () => {
    const spy = vi.fn().mockResolvedValue(undefined)
    __setIpcInvoke(spy as never)
    await setLastSelectedWorkspace("z")
    expect(spy).toHaveBeenCalledWith("set_last_selected_workspace", { id: "z" })
  })

  test("openFolderDialog returns null when dialog returns null", async () => {
    vi.doMock("@tauri-apps/plugin-dialog", () => ({
      open: vi.fn().mockResolvedValue(null),
    }))
    try {
      const out = await openFolderDialog()
      expect(out).toBeNull()
    } finally {
      vi.doUnmock("@tauri-apps/plugin-dialog")
    }
  })
})

describe("ipc wrapper is the only direct tauri importer in app src", () => {
  test("no component or page imports @tauri-apps/api/core directly", async () => {
    const root = resolve(__dirname, "..")
    async function walk(dir: string): Promise<string[]> {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const files: string[] = []
      for (const e of entries) {
        const p = resolve(dir, e.name)
        if (e.isDirectory()) files.push(...(await walk(p)))
        else if (/\.(tsx?|m?[cj]s)$/.test(e.name)) files.push(p)
      }
      return files
    }
    const files = await walk(root)
    const offenders: string[] = []
    for (const f of files) {
      if (f.endsWith("/lib/ipc.ts")) continue
      if (f.includes(".vitest.")) continue
      if (f.includes(".test.")) continue
      const src = await fs.readFile(f, "utf8")
      if (/from\s+["']@tauri-apps\/api\/core["']/.test(src)) {
        offenders.push(f)
      }
    }
    expect(offenders).toEqual([])
  })
})
