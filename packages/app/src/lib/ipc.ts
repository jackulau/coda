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

export interface WriteTextFileArgs {
  path: string
  contents: string
}

export function writeTextFile(args: WriteTextFileArgs): Promise<void>
export function writeTextFile(path: string, contents: string): Promise<void>
export function writeTextFile(
  pathOrArgs: string | WriteTextFileArgs,
  contents?: string,
): Promise<void> {
  const args =
    typeof pathOrArgs === "string" ? { path: pathOrArgs, contents: contents as string } : pathOrArgs
  return call<void>("write_text_file", args as unknown as Record<string, unknown>)
}

// --- file index ---------------------------------------------------------

export function listAllFiles(cwd: string): Promise<string[]> {
  return call<string[]>("list_all_files", { cwd })
}

// --- search -------------------------------------------------------------

export interface SearchHit {
  path: string
  line: number
  column: number
  preview: string
}

export function searchFiles(
  cwd: string,
  query: string,
  caseSensitive?: boolean,
  regex?: boolean,
): Promise<SearchHit[]> {
  return call<SearchHit[]>("search_files", { cwd, query, caseSensitive, regex })
}


// --- git status ---------------------------------------------------------

export type ChangeKind = "add" | "modify" | "delete"

export interface ChangedFile {
  path: string
  kind: ChangeKind
  additions: number
  deletions: number
}

export function listChangedFiles(cwd: string): Promise<ChangedFile[]> {
  return call<ChangedFile[]>("list_changed_files", { cwd })
}

export function getFileDiff(cwd: string, path: string): Promise<string> {
  return call<string>("get_file_diff", { cwd, path })
}

// --- git log ------------------------------------------------------------

export interface GitCommit {
  hash: string
  shortHash: string
  author: string
  date: string
  message: string
  filesChanged: number
  additions: number
  deletions: number
}

export function gitLog(cwd: string, limit?: number, path?: string): Promise<GitCommit[]> {
  return call<GitCommit[]>("git_log", { cwd, limit, path })
}

export function gitCommitDiff(cwd: string, hash: string): Promise<string> {
  return call<string>("git_commit_diff", { cwd, hash })
}


// --- pty ----------------------------------------------------------------

export interface PtySpawnArgs {
  cwd: string
  shell?: string
  rows: number
  cols: number
}

export function ptySpawn(args: PtySpawnArgs): Promise<string> {
  return call<string>("pty_spawn", args as unknown as Record<string, unknown>)
}

export function ptyWrite(sessionId: string, data: string): Promise<void> {
  return call<void>("pty_write", { sessionId, data })
}

export function ptyResize(sessionId: string, rows: number, cols: number): Promise<void> {
  return call<void>("pty_resize", { sessionId, rows, cols })
}

export function ptyKill(sessionId: string): Promise<void> {
  return call<void>("pty_kill", { sessionId })
}

// --- workspace registry -------------------------------------------------

export interface RegisterWorkspaceArgs {
  rootPath: string
  name?: string
}

export function registerWorkspace(args: RegisterWorkspaceArgs): Promise<WorkspaceRecord>
export function registerWorkspace(rootPath: string, name?: string): Promise<WorkspaceRecord>
export function registerWorkspace(
  rootPathOrArgs: string | RegisterWorkspaceArgs,
  name?: string,
): Promise<WorkspaceRecord> {
  const args =
    typeof rootPathOrArgs === "string" ? { rootPath: rootPathOrArgs, name } : rootPathOrArgs
  return call<WorkspaceRecord>("register_workspace", args as unknown as Record<string, unknown>)
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
