export type PtyState = "spawning" | "running" | "exited" | "failed"

export interface PtyDriverSpawnOpts {
  id: string
  cwd: string
  cmd: string
  args?: string[]
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export interface PtyDriver {
  spawn(opts: PtyDriverSpawnOpts): Promise<void>
  write(id: string, data: string): void
  resize(id: string, cols: number, rows: number): void
  kill(id: string, signal?: "SIGTERM" | "SIGKILL"): Promise<number | null>
  onData(id: string, fn: (chunk: string) => void): () => void
  onExit(id: string, fn: (code: number) => void): () => void
  state(id: string): PtyState
}

interface MockSession {
  id: string
  state: PtyState
  listeners: {
    data: Set<(c: string) => void>
    exit: Set<(c: number) => void>
  }
  cols: number
  rows: number
  scriptedOutput: string[]
  exitCode: number | null
  enospc: boolean
}

export interface MockPtyDriverOptions {
  spawnDelayMs?: number
  spawnShouldFail?: boolean
  now?: () => number
}

export class MockPtyDriver implements PtyDriver {
  private sessions = new Map<string, MockSession>()
  private readonly opts: Required<Pick<MockPtyDriverOptions, "spawnDelayMs" | "spawnShouldFail">>

  constructor(options: MockPtyDriverOptions = {}) {
    this.opts = {
      spawnDelayMs: options.spawnDelayMs ?? 0,
      spawnShouldFail: options.spawnShouldFail ?? false,
    }
  }

  async spawn(opts: PtyDriverSpawnOpts): Promise<void> {
    if (this.sessions.has(opts.id)) {
      throw new Error(`session already exists: ${opts.id}`)
    }
    const session: MockSession = {
      id: opts.id,
      state: "spawning",
      listeners: { data: new Set(), exit: new Set() },
      cols: opts.cols ?? 80,
      rows: opts.rows ?? 24,
      scriptedOutput: [],
      exitCode: null,
      enospc: false,
    }
    this.sessions.set(opts.id, session)
    if (this.opts.spawnDelayMs > 0) {
      await new Promise((r) => setTimeout(r, this.opts.spawnDelayMs))
    }
    if (this.opts.spawnShouldFail) {
      session.state = "failed"
      throw new Error("spawn failed")
    }
    session.state = "running"
  }

  write(id: string, data: string): void {
    const s = this.required(id)
    if (s.state !== "running") return
    if (s.enospc) {
      for (const fn of s.listeners.exit) fn(28)
      s.state = "exited"
      s.exitCode = 28
      return
    }
    for (const fn of s.listeners.data) fn(`echo:${data}`)
  }

  resize(id: string, cols: number, rows: number): void {
    const s = this.required(id)
    s.cols = cols
    s.rows = rows
  }

  async kill(id: string, signal: "SIGTERM" | "SIGKILL" = "SIGTERM"): Promise<number | null> {
    const s = this.required(id)
    if (s.state === "exited" || s.state === "failed") return s.exitCode
    const code = signal === "SIGTERM" ? 143 : 137
    s.exitCode = code
    s.state = "exited"
    for (const fn of s.listeners.exit) fn(code)
    return code
  }

  onData(id: string, fn: (chunk: string) => void): () => void {
    const s = this.required(id)
    s.listeners.data.add(fn)
    return () => {
      s.listeners.data.delete(fn)
    }
  }

  onExit(id: string, fn: (code: number) => void): () => void {
    const s = this.required(id)
    s.listeners.exit.add(fn)
    return () => {
      s.listeners.exit.delete(fn)
    }
  }

  state(id: string): PtyState {
    return this.sessions.get(id)?.state ?? "exited"
  }

  pushOutput(id: string, chunk: string): void {
    const s = this.required(id)
    for (const fn of s.listeners.data) fn(chunk)
  }

  triggerExit(id: string, code: number): void {
    const s = this.required(id)
    s.exitCode = code
    s.state = "exited"
    for (const fn of s.listeners.exit) fn(code)
  }

  setEnospc(id: string, v: boolean): void {
    this.required(id).enospc = v
  }

  private required(id: string): MockSession {
    const s = this.sessions.get(id)
    if (!s) throw new Error(`unknown session: ${id}`)
    return s
  }
}
