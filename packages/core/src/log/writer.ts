import { redactObject } from "./redact"

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogRecord {
  ts: number
  level: LogLevel
  msg: string
  source: string
  data?: Record<string, unknown>
}

export interface LogSink {
  write(line: string): void
  rotate?(): void
  current(): string[]
}

export class MemorySink implements LogSink {
  private lines: string[] = []
  private rotated: string[][] = []

  constructor(public readonly maxLines = 1000) {}

  write(line: string): void {
    if (this.lines.length >= this.maxLines) {
      this.rotate()
    }
    this.lines.push(line)
  }

  rotate(): void {
    if (this.lines.length === 0) return
    this.rotated.push(this.lines)
    this.lines = []
  }

  current(): string[] {
    return [...this.lines]
  }

  history(): string[][] {
    return this.rotated.map((b) => [...b])
  }
}

export interface LogWriterOptions {
  sink: LogSink
  source: string
  now?: () => number
  minLevel?: LogLevel
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export class LogWriter {
  private readonly sink: LogSink
  private readonly source: string
  private readonly now: () => number
  private readonly minLevel: LogLevel

  constructor(opts: LogWriterOptions) {
    this.sink = opts.sink
    this.source = opts.source
    this.now = opts.now ?? (() => Date.now())
    this.minLevel = opts.minLevel ?? "info"
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.write("debug", msg, data)
  }
  info(msg: string, data?: Record<string, unknown>): void {
    this.write("info", msg, data)
  }
  warn(msg: string, data?: Record<string, unknown>): void {
    this.write("warn", msg, data)
  }
  error(msg: string, data?: Record<string, unknown>): void {
    this.write("error", msg, data)
  }

  private write(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return
    const record: LogRecord = {
      ts: this.now(),
      level,
      source: this.source,
      msg,
      ...(data !== undefined && { data: redactObject(data) }),
    }
    this.sink.write(JSON.stringify(record))
  }
}
