export interface CapturedError {
  message: string
  source: "error" | "unhandledrejection"
  at: number
}

export class GlobalErrorRecorder {
  private queue: CapturedError[] = []
  capture(message: string, source: "error" | "unhandledrejection", at: number): void {
    const last = this.queue[this.queue.length - 1]
    if (last && last.message === message && at - last.at < 500) return
    this.queue.push({ message, source, at })
  }
  list(): CapturedError[] {
    return [...this.queue]
  }
}
