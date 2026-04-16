import { WatchdogCircuit, type WatchdogOptions } from "./watchdog"

export interface SupervisedProcess {
  name: string
  start(): Promise<void>
  ping(): Promise<boolean>
}

export interface SupervisorOptions extends WatchdogOptions {
  pingIntervalMs?: number
  pingTimeoutMs?: number
}

export type SupervisorEvent =
  | { kind: "started"; name: string; attempt: number }
  | { kind: "healthy"; name: string }
  | { kind: "crash"; name: string; reason: string; delayMs: number }
  | { kind: "circuit-open"; name: string }

export class Supervisor {
  private circuit: WatchdogCircuit
  private readonly pingIntervalMs: number
  private readonly events: SupervisorEvent[] = []

  constructor(
    private readonly proc: SupervisedProcess,
    opts: SupervisorOptions = {},
  ) {
    this.circuit = new WatchdogCircuit(opts)
    this.pingIntervalMs = opts.pingIntervalMs ?? 1000
  }

  async startOnce(): Promise<void> {
    await this.proc.start()
    this.events.push({ kind: "started", name: this.proc.name, attempt: 1 })
  }

  async tick(): Promise<SupervisorEvent | null> {
    const healthy = await this.proc.ping()
    if (healthy) {
      this.circuit.recordHealthy()
      const ev: SupervisorEvent = { kind: "healthy", name: this.proc.name }
      this.events.push(ev)
      return ev
    }
    const action = this.circuit.recordCrash("ping-failed")
    if (action === "circuit-open") {
      const ev: SupervisorEvent = { kind: "circuit-open", name: this.proc.name }
      this.events.push(ev)
      return ev
    }
    const ev: SupervisorEvent = {
      kind: "crash",
      name: this.proc.name,
      reason: "ping-failed",
      delayMs: action.delayMs,
    }
    this.events.push(ev)
    try {
      await this.proc.start()
    } catch {
      // swallow: next tick will record another crash
    }
    return ev
  }

  history(): SupervisorEvent[] {
    return [...this.events]
  }

  circuitState(): "healthy" | "restarting" | "open" {
    return this.circuit.currentState()
  }
}
