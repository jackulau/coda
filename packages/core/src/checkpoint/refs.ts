export const CHECKPOINT_REF_PREFIX = "refs/coda/checkpoints"

export interface CheckpointRef {
  ref: string
  workspaceId: string
  turnId: string
  createdAt: number
  label?: string
}

export function buildRef(workspaceId: string, turnId: string): string {
  if (!/^[a-z0-9-]+$/i.test(workspaceId)) {
    throw new Error(`workspaceId has invalid chars: ${workspaceId}`)
  }
  if (!/^[a-z0-9-]+$/i.test(turnId)) {
    throw new Error(`turnId has invalid chars: ${turnId}`)
  }
  return `${CHECKPOINT_REF_PREFIX}/${workspaceId}/${turnId}`
}

export function parseRef(ref: string): { workspaceId: string; turnId: string } | null {
  if (!ref.startsWith(`${CHECKPOINT_REF_PREFIX}/`)) return null
  const rest = ref.slice(CHECKPOINT_REF_PREFIX.length + 1)
  const slash = rest.indexOf("/")
  if (slash === -1) return null
  return { workspaceId: rest.slice(0, slash), turnId: rest.slice(slash + 1) }
}

export interface PruneOptions {
  keepPerWorkspace: number
  now: number
  maxAgeMs: number
}

export function selectForPrune(refs: CheckpointRef[], opts: PruneOptions): CheckpointRef[] {
  const byWorkspace = new Map<string, CheckpointRef[]>()
  for (const r of refs) {
    const arr = byWorkspace.get(r.workspaceId) ?? []
    arr.push(r)
    byWorkspace.set(r.workspaceId, arr)
  }
  const toPrune: CheckpointRef[] = []
  for (const [, arr] of byWorkspace) {
    const sorted = [...arr].sort((a, b) => b.createdAt - a.createdAt)
    for (let i = 0; i < sorted.length; i++) {
      const ref = sorted[i]
      if (!ref) continue
      if (opts.now - ref.createdAt > opts.maxAgeMs) {
        toPrune.push(ref)
        continue
      }
      if (i >= opts.keepPerWorkspace) toPrune.push(ref)
    }
  }
  return toPrune
}
