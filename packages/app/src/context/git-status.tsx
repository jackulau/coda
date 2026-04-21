import {
  type Component,
  type JSX,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from "solid-js"
import { type ChangedFile, listChangedFiles } from "../lib/ipc"
import { useWorkspaces } from "./workspace"

const POLL_MS = 3000

interface GitStatusCtx {
  files: () => ChangedFile[]
  summary: () => { additions: number; deletions: number }
  refresh: () => Promise<void>
}

const Ctx = createContext<GitStatusCtx>()

export const GitStatusProvider: Component<{ children: JSX.Element }> = (props) => {
  const ws = useWorkspaces()
  const [files, setFiles] = createSignal<ChangedFile[]>([])
  let cancelled = false
  let timer: ReturnType<typeof setInterval> | null = null

  const refresh = async () => {
    const sel = ws.workspaces().find((w) => w.id === ws.selectedId())
    if (!sel) {
      if (!cancelled) setFiles([])
      return
    }
    try {
      const raw = await listChangedFiles(sel.cwd)
      if (!cancelled) setFiles(raw)
    } catch {
      // Non-fatal: non-git folders, transient process failures, etc.
      // The last-known list stays rendered until next successful poll.
    }
  }

  onMount(() => {
    void refresh()
    timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      void refresh()
    }, POLL_MS)
  })
  onCleanup(() => {
    cancelled = true
    if (timer) clearInterval(timer)
  })

  createEffect(() => {
    ws.selectedId()
    void refresh()
  })

  const summary = createMemo(() => {
    let additions = 0
    let deletions = 0
    for (const f of files()) {
      additions += f.additions
      deletions += f.deletions
    }
    return { additions, deletions }
  })

  return <Ctx.Provider value={{ files, summary, refresh }}>{props.children}</Ctx.Provider>
}

export function useGitStatus(): GitStatusCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error("useGitStatus must be used within GitStatusProvider")
  return v
}
