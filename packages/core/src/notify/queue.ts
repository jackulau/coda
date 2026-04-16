export type NotificationLevel = "info" | "success" | "warning" | "error"

export interface Notification {
  id: string
  level: NotificationLevel
  message: string
  hint?: string
  dedupKey?: string
  createdAt: number
  expiresAt: number
}

export interface EnqueueInput {
  level: NotificationLevel
  message: string
  hint?: string
  dedupKey?: string
  ttlMs?: number
}

export interface NotificationQueueOptions {
  capacity?: number
  defaultTtlMs?: number
  now?: () => number
}

const DEFAULTS = {
  capacity: 5,
  defaultTtlMs: 6_000,
}

export class NotificationQueue {
  private readonly items: Notification[] = []
  private readonly capacity: number
  private readonly defaultTtlMs: number
  private readonly now: () => number

  constructor(opts: NotificationQueueOptions = {}) {
    this.capacity = opts.capacity ?? DEFAULTS.capacity
    this.defaultTtlMs = opts.defaultTtlMs ?? DEFAULTS.defaultTtlMs
    this.now = opts.now ?? (() => Date.now())
  }

  enqueue(input: EnqueueInput): Notification {
    const now = this.now()
    const ttl = input.ttlMs ?? this.defaultTtlMs
    if (input.dedupKey) {
      const existing = this.items.find((n) => n.dedupKey === input.dedupKey)
      if (existing) {
        existing.expiresAt = now + ttl
        existing.message = input.message
        if (input.hint !== undefined) existing.hint = input.hint
        existing.level = input.level
        return existing
      }
    }
    const notif: Notification = {
      id: crypto.randomUUID(),
      level: input.level,
      message: input.message,
      ...(input.hint !== undefined && { hint: input.hint }),
      ...(input.dedupKey !== undefined && { dedupKey: input.dedupKey }),
      createdAt: now,
      expiresAt: now + ttl,
    }
    this.items.push(notif)
    if (this.items.length > this.capacity) this.items.shift()
    return notif
  }

  dismiss(id: string): boolean {
    const idx = this.items.findIndex((n) => n.id === id)
    if (idx === -1) return false
    this.items.splice(idx, 1)
    return true
  }

  sweep(): number {
    const now = this.now()
    let removed = 0
    for (let i = this.items.length - 1; i >= 0; i--) {
      if ((this.items[i]?.expiresAt ?? 0) <= now) {
        this.items.splice(i, 1)
        removed++
      }
    }
    return removed
  }

  list(): Notification[] {
    return [...this.items]
  }

  clear(): void {
    this.items.length = 0
  }
}
