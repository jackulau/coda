/**
 * AppError gives components a single stable shape to surface as toasts,
 * inline errors, or log entries. We normalize all thrown values (Rust
 * error strings, `Error` instances, JSON payloads) into this shape at
 * the IPC boundary so UI code never has to branch on `typeof`.
 */
export interface AppError {
  /** Short human-readable message. Safe to render in a toast. */
  message: string
  /** Optional longer explanation / stack / backend context. */
  detail?: string
  /** The IPC cmd (or other op id) that produced this error, if known. */
  source?: string
  /** Arbitrary structured context for logging (args passed, path, etc). */
  context?: Record<string, unknown>
}

/** Legacy helper retained for existing callers. */
export function normalizeError(input: unknown): Error {
  if (input instanceof Error) return input
  return new Error(typeof input === "string" ? input : JSON.stringify(input))
}

/**
 * Wrap any thrown value into an AppError. Handles:
 *   - strings (the common Rust `Result<T, String>` case)
 *   - Error instances (keeps the stack in .detail)
 *   - objects with a `.message` field
 *   - anything else (stringified as fallback)
 */
export function normalizeErrorToAppError(
  input: unknown,
  meta?: { cmd?: string; [k: string]: unknown },
): AppError {
  const source = meta?.cmd
  const context: Record<string, unknown> | undefined = meta
    ? Object.fromEntries(Object.entries(meta).filter(([k]) => k !== "cmd"))
    : undefined
  if (typeof input === "string") {
    return { message: input, source, context }
  }
  if (input instanceof Error) {
    return {
      message: input.message,
      detail: input.stack ?? undefined,
      source,
      context,
    }
  }
  if (input && typeof input === "object") {
    const rec = input as Record<string, unknown>
    const message = typeof rec.message === "string" ? rec.message : JSON.stringify(input)
    return { message, detail: undefined, source, context }
  }
  return { message: String(input), source, context }
}

/** True if the value has the AppError shape. Useful for typeguards. */
export function isAppError(v: unknown): v is AppError {
  return !!v && typeof v === "object" && typeof (v as { message?: unknown }).message === "string"
}
