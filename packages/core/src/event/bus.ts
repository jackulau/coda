type Listener<T> = (value: T) => void

type EventMap = { [key: string]: unknown }

export class EventBus<Map extends EventMap> {
  private listeners: { [K in keyof Map]?: Set<Listener<Map[K]>> } = {}

  on<K extends keyof Map>(event: K, fn: Listener<Map[K]>): () => void {
    let set = this.listeners[event]
    if (!set) {
      set = new Set()
      this.listeners[event] = set
    }
    set.add(fn)
    return () => {
      set.delete(fn)
    }
  }

  once<K extends keyof Map>(event: K, fn: Listener<Map[K]>): () => void {
    const off = this.on(event, (v) => {
      off()
      fn(v)
    })
    return off
  }

  emit<K extends keyof Map>(event: K, value: Map[K]): void {
    const set = this.listeners[event]
    if (!set) return
    for (const fn of [...set]) {
      try {
        fn(value)
      } catch (err) {
        console.error("[bus] listener threw", { event, err })
      }
    }
  }

  listenerCount<K extends keyof Map>(event: K): number {
    return this.listeners[event]?.size ?? 0
  }

  removeAll(): void {
    this.listeners = {}
  }
}

export type CodaEvents = {
  "Project.Updated": { id: string; uiOrder?: number; expanded?: boolean }
  "Workspace.Updated": {
    id: string
    uiOrder?: number
    lastFocusedAt?: number
    pinned?: boolean
  }
  "Workspace.Created": { id: string; projectId: string }
  "Workspace.Deleted": { id: string }
  "PtySession.Created": { id: string; workspaceId: string }
  "PtySession.Exited": { id: string; exitCode: number; at: number }
  "Pr.Fetched": { number: number; headSha: string }
  "Sidecar.Crashed": { reason: string; restartAttempt: number }
}

export const codaBus = new EventBus<CodaEvents>()
