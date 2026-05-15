/**
 * AgentQueue — FIFO buffer for prompts the user types while an agent
 * (Claude Code, Codex, etc.) is still processing a prior message. Drops
 * nothing. Dispatches strictly in order via a caller-supplied send fn.
 *
 * Busy state is owned by the caller (typically derived from PTY activity
 * heuristics or an explicit prompt-ready signal). drain() is idempotent
 * and safe to call from listeners on every state change.
 */

export interface PendingMessage {
  readonly id: string
  readonly text: string
  readonly enqueuedAt: number
}

export interface AgentQueueOptions {
  /** Override clock for tests. */
  now?: () => number
  /** Override id generator for tests. */
  id?: () => string
}

export type QueueListener = () => void
export type SendFn = (text: string) => void | Promise<void>

export class AgentQueue {
  private items: PendingMessage[] = []
  private isBusy = false
  private listeners = new Set<QueueListener>()
  private readonly now: () => number
  private readonly id: () => string

  constructor(opts: AgentQueueOptions = {}) {
    this.now = opts.now ?? (() => Date.now())
    this.id = opts.id ?? (() => crypto.randomUUID())
  }

  subscribe(fn: QueueListener): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private notify(): void {
    for (const fn of this.listeners) fn()
  }

  enqueue(text: string): PendingMessage | null {
    if (text.length === 0) return null
    const msg: PendingMessage = {
      id: this.id(),
      text,
      enqueuedAt: this.now(),
    }
    this.items.push(msg)
    this.notify()
    return msg
  }

  cancel(id: string): boolean {
    const idx = this.items.findIndex((m) => m.id === id)
    if (idx === -1) return false
    this.items.splice(idx, 1)
    this.notify()
    return true
  }

  /** Replace text of a pending message (e.g. user edits before send). */
  edit(id: string, text: string): boolean {
    const idx = this.items.findIndex((m) => m.id === id)
    if (idx === -1) return false
    const prev = this.items[idx]
    if (!prev) return false
    this.items[idx] = { id: prev.id, enqueuedAt: prev.enqueuedAt, text }
    this.notify()
    return true
  }

  list(): readonly PendingMessage[] {
    return this.items.slice()
  }

  size(): number {
    return this.items.length
  }

  busy(): boolean {
    return this.isBusy
  }

  setBusy(busy: boolean): void {
    if (this.isBusy === busy) return
    this.isBusy = busy
    this.notify()
  }

  clear(): void {
    if (this.items.length === 0) return
    this.items = []
    this.notify()
  }

  /**
   * Attempt to dispatch the head of the queue. No-op when busy or empty.
   * Marks busy=true before sending so concurrent drain calls don't
   * double-dispatch. Caller must call setBusy(false) when the agent is
   * ready again (typically via a prompt-ready PTY heuristic).
   *
   * Returns the dispatched message, or null when nothing was sent.
   * Re-queues the message at the head if send() throws so no input is lost.
   */
  async drain(send: SendFn): Promise<PendingMessage | null> {
    if (this.isBusy) return null
    const next = this.items.shift()
    if (!next) return null
    this.isBusy = true
    this.notify()
    try {
      await send(next.text)
      return next
    } catch (err) {
      this.items.unshift(next)
      this.isBusy = false
      this.notify()
      throw err
    }
  }
}
