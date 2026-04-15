import { codaBus } from "../event/bus"

export type WatchdogState = "healthy" | "restarting" | "open"

export interface WatchdogOptions {
  baseDelayMs?: number
  maxDelayMs?: number
  threshold?: number
  windowMs?: number
  now?: () => number
}

export interface RestartHandle {
  attempt: number
  delayMs: number
}

const DEFAULTS = {
  baseDelayMs: 200,
  maxDelayMs: 30_000,
  threshold: 5,
  windowMs: 60_000,
}

export class WatchdogCircuit {
  private readonly opts: Required<WatchdogOptions>
  private readonly history: number[] = []
  private state: WatchdogState = "healthy"
  private consecutive = 0

  constructor(options: WatchdogOptions = {}) {
    this.opts = {
      baseDelayMs: options.baseDelayMs ?? DEFAULTS.baseDelayMs,
      maxDelayMs: options.maxDelayMs ?? DEFAULTS.maxDelayMs,
      threshold: options.threshold ?? DEFAULTS.threshold,
      windowMs: options.windowMs ?? DEFAULTS.windowMs,
      now: options.now ?? (() => Date.now()),
    }
  }

  recordCrash(reason: string): RestartHandle | "circuit-open" {
    const ts = this.opts.now()
    this.history.push(ts)
    while (this.history.length > 0 && (this.history[0] ?? 0) < ts - this.opts.windowMs) {
      this.history.shift()
    }
    if (this.history.length >= this.opts.threshold) {
      this.state = "open"
      codaBus.emit("Sidecar.Crashed", { reason: `circuit-open:${reason}`, restartAttempt: -1 })
      return "circuit-open"
    }
    this.consecutive++
    this.state = "restarting"
    const delayMs = Math.min(
      this.opts.baseDelayMs * 2 ** (this.consecutive - 1),
      this.opts.maxDelayMs,
    )
    codaBus.emit("Sidecar.Crashed", { reason, restartAttempt: this.consecutive })
    return { attempt: this.consecutive, delayMs }
  }

  recordHealthy(): void {
    this.consecutive = 0
    this.state = "healthy"
  }

  reset(): void {
    this.history.length = 0
    this.consecutive = 0
    this.state = "healthy"
  }

  currentState(): WatchdogState {
    return this.state
  }

  crashesInWindow(): number {
    const ts = this.opts.now()
    return this.history.filter((t) => t >= ts - this.opts.windowMs).length
  }
}
