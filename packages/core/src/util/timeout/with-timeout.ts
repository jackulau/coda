export class TimeoutError extends Error {
  override readonly name = "TimeoutError"
  constructor(
    public readonly tag: string,
    public readonly ms: number,
  ) {
    super(`${tag} timed out after ${ms}ms`)
  }
}

export interface TimeoutOptions {
  signal?: AbortSignal
  now?: () => number
  schedule?: (cb: () => void, ms: number) => () => void
}

export function withTimeout<T>(
  tag: string,
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
  opts: TimeoutOptions = {},
): Promise<T> {
  if (!Number.isFinite(ms)) {
    throw new TypeError(`withTimeout: invalid ms ${ms} for ${tag}`)
  }
  if (ms < 0) {
    throw new RangeError(`withTimeout: negative ms ${ms} for ${tag}`)
  }
  const controller = new AbortController()
  const external = opts.signal
  if (external) {
    if (external.aborted) controller.abort(external.reason)
    else external.addEventListener("abort", () => controller.abort(external.reason), { once: true })
  }
  const schedule =
    opts.schedule ??
    ((cb, delay) => {
      const t = setTimeout(cb, delay)
      return () => clearTimeout(t)
    })
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const cancel = schedule(() => {
      if (settled) return
      settled = true
      controller.abort(new TimeoutError(tag, ms))
      reject(new TimeoutError(tag, ms))
    }, ms)
    fn(controller.signal)
      .then((v) => {
        if (settled) return
        settled = true
        cancel()
        resolve(v)
      })
      .catch((e) => {
        if (settled) return
        settled = true
        cancel()
        reject(e)
      })
  })
}
