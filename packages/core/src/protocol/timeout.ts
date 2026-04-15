export const DEFAULT_TIMEOUT_MS = 5_000

export class TimeoutError extends Error {
  readonly code = "TIMEOUT"
  constructor(
    message: string,
    public readonly timeoutMs: number,
  ) {
    super(message)
    this.name = "TimeoutError"
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  label = "operation",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError(`${label} timed out after ${timeoutMs}ms`, timeoutMs))
    }, timeoutMs)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function abortableSignal(timeoutMs: number = DEFAULT_TIMEOUT_MS): AbortSignal {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs)
  }
  const ctrl = new AbortController()
  setTimeout(() => ctrl.abort(new TimeoutError("aborted", timeoutMs)), timeoutMs)
  return ctrl.signal
}
