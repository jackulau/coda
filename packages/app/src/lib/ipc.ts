// Typed wrapper around every Tauri command the frontend uses. One file
// per project-wide pattern: components never call `invoke()` directly;
// they import one of these helpers. That keeps all IPC error-handling,
// typing, and test-mocking in one place.

import { invoke as tauriInvoke } from "@tauri-apps/api/core"
import { normalizeErrorToAppError } from "../components/error-normalize"
import type { AppError } from "../components/error-normalize"

// --- types that mirror the Rust side ------------------------------------

export interface DirEntry {
  name: string
  path: string
  kind: "file" | "directory"
  size?: number
  /** True for node_modules / .git / target — heavy trees the UI can
   *  render collapsed with a load-anyway affordance. */
  heavy?: boolean
  /** True on the synthetic last entry when the dir hit MAX_DIR_ENTRIES;
   *  `name` contains a human "…and N more hidden" string. */
  truncated?: boolean
}

export interface WorkspaceRecord {
  id: string
  name: string
  rootPath: string
  addedAt: string
}

// --- mock hook ----------------------------------------------------------

type InvokeFn = typeof tauriInvoke
let invokeImpl: InvokeFn = tauriInvoke

/** Test-only: install a fake `invoke` so component tests don't need Tauri. */
export function __setIpcInvoke(fn: InvokeFn): void {
  invokeImpl = fn
}

/** Test-only: restore the real invoke. */
export function __resetIpcInvoke(): void {
  invokeImpl = tauriInvoke
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return (await invokeImpl<T>(cmd, args ?? {})) as T
  } catch (raw) {
    throw normalizeErrorToAppError(raw, { cmd, args })
  }
}

// --- file system --------------------------------------------------------

export function listDirectory(path: string): Promise<DirEntry[]> {
  return call<DirEntry[]>("list_directory", { path })
}

export function readTextFile(path: string): Promise<string> {
  return call<string>("read_text_file", { path })
}

export function writeTextFile(path: string, contents: string): Promise<void> {
  return call<void>("write_text_file", { path, contents })
}

// --- workspace registry -------------------------------------------------

export function registerWorkspace(rootPath: string, name?: string): Promise<WorkspaceRecord> {
  return call<WorkspaceRecord>("register_workspace", { rootPath, name })
}

export function unregisterWorkspace(id: string): Promise<void> {
  return call<void>("unregister_workspace", { id })
}

export function listWorkspaces(): Promise<WorkspaceRecord[]> {
  return call<WorkspaceRecord[]>("list_workspaces")
}

export function getLastSelectedWorkspace(): Promise<string | null> {
  return call<string | null>("get_last_selected_workspace")
}

export function setLastSelectedWorkspace(id: string): Promise<void> {
  return call<void>("set_last_selected_workspace", { id })
}

// --- dialog / opener plugins -------------------------------------------

// Plugins are imported lazily so our unit tests can stub them without
// webview-only globals leaking in. `openFolderDialog` may return null if
// the user cancels the picker.
export async function openFolderDialog(): Promise<string | null> {
  try {
    const mod = await import("@tauri-apps/plugin-dialog")
    const result = await mod.open({ directory: true, multiple: false })
    if (result === null) return null
    return Array.isArray(result) ? (result[0] ?? null) : result
  } catch (raw) {
    throw normalizeErrorToAppError(raw, { cmd: "dialog:open" })
  }
}

export async function revealInFinder(path: string): Promise<void> {
  try {
    const mod = await import("@tauri-apps/plugin-opener")
    await mod.revealItemInDir(path)
  } catch (raw) {
    throw normalizeErrorToAppError(raw, { cmd: "opener:reveal", path })
  }
}

export type { AppError }
