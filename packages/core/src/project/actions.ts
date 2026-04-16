import { ProjectStore, type ProjectUpdatePatch } from "./store"

export interface ProjectIo {
  exists(path: string): Promise<boolean>
  reveal(path: string): Promise<void>
  cloneWorktree(args: { rootPath: string; newName: string; baseBranch: string }): Promise<string>
}

export type ActionResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string }

export async function renameProject(
  id: string,
  newName: string,
): Promise<ActionResult<{ id: string; name: string }>> {
  const trimmed = newName.trim()
  if (trimmed.length === 0) return { ok: false, code: "invalid-name", message: "name empty" }
  if (trimmed.length > 120) return { ok: false, code: "invalid-name", message: "name too long" }
  const cur = ProjectStore.get(id)
  if (!cur) return { ok: false, code: "not-found", message: `project ${id} not found` }
  const patch: ProjectUpdatePatch = { name: trimmed }
  const updated = ProjectStore.update(id, patch)
  return { ok: true, value: { id, name: updated.name } }
}

export async function removeProject(id: string): Promise<ActionResult> {
  const cur = ProjectStore.get(id)
  if (!cur) return { ok: false, code: "not-found", message: `project ${id} not found` }
  ProjectStore.delete(id)
  return { ok: true, value: undefined }
}

export async function revealProject(id: string, io: ProjectIo): Promise<ActionResult> {
  const p = ProjectStore.get(id)
  if (!p) return { ok: false, code: "not-found", message: `project ${id} not found` }
  const exists = await io.exists(p.rootPath)
  if (!exists) return { ok: false, code: "missing-on-disk", message: `${p.rootPath} not on disk` }
  await io.reveal(p.rootPath)
  return { ok: true, value: undefined }
}

export async function cloneAsWorktree(
  id: string,
  newName: string,
  baseBranch: string,
  io: ProjectIo,
): Promise<ActionResult<{ path: string }>> {
  const p = ProjectStore.get(id)
  if (!p) return { ok: false, code: "not-found", message: `project ${id} not found` }
  const safeName = newName.trim()
  if (!/^[a-z0-9-]+$/i.test(safeName)) {
    return { ok: false, code: "invalid-name", message: "name must match [a-z0-9-]+" }
  }
  try {
    const path = await io.cloneWorktree({
      rootPath: p.rootPath,
      newName: safeName,
      baseBranch,
    })
    return { ok: true, value: { path } }
  } catch (err) {
    return {
      ok: false,
      code: "clone-failed",
      message: err instanceof Error ? err.message : String(err),
    }
  }
}
