export const PERSIST_DEBOUNCE_MS = 500

export interface DebouncedPersist<T> {
  flush(value: T): void
  cancel(): void
}

export function createDebouncedPersist<T>(
  key: string,
  storage: Pick<Storage, "setItem" | "getItem">,
  debounceMs = PERSIST_DEBOUNCE_MS,
): DebouncedPersist<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    flush(value: T): void {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        storage.setItem(key, JSON.stringify(value))
      }, debounceMs)
    },
    cancel(): void {
      if (timer) clearTimeout(timer)
    },
  }
}

export function loadPersisted<T>(key: string, storage: Pick<Storage, "getItem">, fallback: T): T {
  try {
    const raw = storage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<T>
    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}
