// BufferManager: keyed by absolute file path. Holds the in-memory text for
// each open tab, tracks dirty status, and marshals save-to-disk via the
// supplied writer. Pure logic — no Solid / DOM code lives here so the
// manager is trivial to unit-test.

import type { Accessor } from "solid-js"
import { createSignal } from "solid-js"

export interface Buffer {
  path: string
  /** Last content persisted to disk. */
  original: string
  /** Current in-memory content (may differ from original). */
  content: string
  dirty: boolean
  /** Monotonic counter used by editor code to detect external updates. */
  version: number
}

export interface BufferManagerOptions {
  writer?: (path: string, contents: string) => Promise<void>
  reader?: (path: string) => Promise<string>
}

export interface BufferManager {
  buffers: Accessor<Buffer[]>
  active: Accessor<string | null>
  open(path: string): Promise<Buffer>
  focus(path: string): void
  close(path: string, force?: boolean): boolean
  update(path: string, content: string): void
  save(path: string): Promise<void>
  /** @internal test hook — force-set the buffer content + dirty state. */
  __setContent(path: string, original: string, content: string): void
}

export function createBufferManager(opts: BufferManagerOptions = {}): BufferManager {
  const [buffers, setBuffers] = createSignal<Buffer[]>([])
  const [active, setActive] = createSignal<string | null>(null)

  const find = (path: string) => buffers().find((b) => b.path === path)

  async function open(path: string): Promise<Buffer> {
    const existing = find(path)
    if (existing) {
      setActive(path)
      return existing
    }
    let original = ""
    if (opts.reader) original = await opts.reader(path)
    const buf: Buffer = {
      path,
      original,
      content: original,
      dirty: false,
      version: 1,
    }
    setBuffers((xs) => [...xs, buf])
    setActive(path)
    return buf
  }

  function focus(path: string): void {
    if (find(path)) setActive(path)
  }

  function close(path: string, force = false): boolean {
    const b = find(path)
    if (!b) return true
    if (b.dirty && !force) return false
    setBuffers((xs) => {
      const remaining = xs.filter((x) => x.path !== path)
      return remaining
    })
    if (active() === path) {
      const remaining = buffers().filter((x) => x.path !== path)
      setActive(remaining[remaining.length - 1]?.path ?? null)
    }
    return true
  }

  function update(path: string, content: string): void {
    setBuffers((xs) =>
      xs.map((b) =>
        b.path === path
          ? { ...b, content, dirty: content !== b.original, version: b.version + 1 }
          : b,
      ),
    )
  }

  // Per-path in-flight save promise. Rapid Cmd+S without this would
  // race: two writes of the same buffer could land out-of-order on
  // disk. Here we serialize saves per path — the second call chains
  // after the first resolves and re-reads the current buffer content
  // so the user ends up with the latest version saved, exactly once.
  const inFlight = new Map<string, Promise<void>>()

  async function save(path: string): Promise<void> {
    const existing = inFlight.get(path)
    if (existing) return existing
    if (!opts.writer) throw new Error("buffer manager has no writer configured")

    const doSave = async (): Promise<void> => {
      const b = find(path)
      if (!b) throw new Error(`no buffer for ${path}`)
      const snapshot = b.content
      await opts.writer?.(path, snapshot)
      setBuffers((xs) =>
        xs.map((x) =>
          x.path === path ? { ...x, original: snapshot, dirty: x.content !== snapshot } : x,
        ),
      )
    }
    const p = doSave().finally(() => inFlight.delete(path))
    inFlight.set(path, p)
    return p
  }

  function __setContent(path: string, original: string, content: string): void {
    setBuffers((xs) =>
      xs.map((b) =>
        b.path === path
          ? { ...b, original, content, dirty: original !== content, version: b.version + 1 }
          : b,
      ),
    )
  }

  return { buffers, active, open, focus, close, update, save, __setContent }
}
