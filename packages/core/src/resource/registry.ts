const randomUUID = () => globalThis.crypto.randomUUID()

export type ResourceKind = "timer" | "interval" | "fd" | "socket" | "db" | "worker" | "cache"

export interface ResourceEntry {
  id: string
  kind: ResourceKind
  owner: string
  createdAt: number
  detail?: string
}

const entries = new Map<string, ResourceEntry>()

export const ResourceRegistry = {
  register(entry: Omit<ResourceEntry, "createdAt">): () => void {
    const full: ResourceEntry = { ...entry, createdAt: Date.now() }
    entries.set(entry.id, full)
    return () => {
      entries.delete(entry.id)
    }
  },
  release(id: string): boolean {
    return entries.delete(id)
  },
  list(): ResourceEntry[] {
    return Array.from(entries.values())
  },
  count(kind?: ResourceKind): number {
    if (!kind) return entries.size
    let n = 0
    for (const e of entries.values()) if (e.kind === kind) n++
    return n
  },
  clear(): void {
    entries.clear()
  },
}

export function createTrackedTimer(cb: () => void, ms: number, owner: string): { dispose(): void } {
  const id = `timer-${randomUUID()}`
  const handle = setTimeout(() => {
    ResourceRegistry.release(id)
    cb()
  }, ms)
  const release = ResourceRegistry.register({ id, kind: "timer", owner, detail: `${ms}ms` })
  return {
    dispose() {
      clearTimeout(handle)
      release()
    },
  }
}

export function createTrackedInterval(
  cb: () => void,
  ms: number,
  owner: string,
): { dispose(): void } {
  const id = `interval-${randomUUID()}`
  const handle = setInterval(cb, ms)
  const release = ResourceRegistry.register({ id, kind: "interval", owner, detail: `${ms}ms` })
  return {
    dispose() {
      clearInterval(handle)
      release()
    },
  }
}
