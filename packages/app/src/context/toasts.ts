import { type Accessor, createContext, createSignal, useContext } from "solid-js"

export type ToastKind = "info" | "success" | "warn" | "error"

export interface Toast {
  id: string
  kind: ToastKind
  message: string
  detail?: string
  createdAt: number
}

export interface ToastCtx {
  toasts: Accessor<Toast[]>
  push: (t: Omit<Toast, "id" | "createdAt"> & { id?: string }) => string
  dismiss: (id: string) => void
  clear: () => void
  info: (message: string, detail?: string) => string
  success: (message: string, detail?: string) => string
  warn: (message: string, detail?: string) => string
  error: (message: string, detail?: string) => string
}

const Ctx = createContext<ToastCtx>()

let nextId = 1

export function createToastCtx(): ToastCtx {
  const [toasts, setToasts] = createSignal<Toast[]>([])
  function dismiss(id: string): void {
    setToasts((xs) => xs.filter((t) => t.id !== id))
  }
  function push(input: Omit<Toast, "id" | "createdAt"> & { id?: string }): string {
    const id = input.id ?? `t-${nextId++}`
    const t: Toast = {
      id,
      kind: input.kind,
      message: input.message,
      detail: input.detail,
      createdAt: Date.now(),
    }
    setToasts((xs) => [...xs, t])
    if (t.kind !== "error" && typeof window !== "undefined") {
      const timeout = 3000
      setTimeout(() => dismiss(id), timeout)
    }
    return id
  }
  return {
    toasts,
    push,
    dismiss,
    clear: () => setToasts([]),
    info: (m, d) => push({ kind: "info", message: m, detail: d }),
    success: (m, d) => push({ kind: "success", message: m, detail: d }),
    warn: (m, d) => push({ kind: "warn", message: m, detail: d }),
    error: (m, d) => push({ kind: "error", message: m, detail: d }),
  }
}

export { Ctx as ToastContext }

export function useToasts(): ToastCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error("useToasts must be used within ToastProvider")
  return v
}
