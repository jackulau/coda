import {
  type Component,
  type JSX,
  createContext,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from "solid-js"
import { listAllFiles } from "../lib/ipc"
import { useWorkspaces } from "./workspace"

interface FileIndexCtx {
  files: () => string[]
  loading: () => boolean
  refresh: () => void
}

const Ctx = createContext<FileIndexCtx>()

export const FileIndexProvider: Component<{ children: JSX.Element }> = (props) => {
  const ws = useWorkspaces()
  const [files, setFiles] = createSignal<string[]>([])
  const [loading, setLoading] = createSignal(false)
  let lastCwd = ""

  const load = () => {
    const focused = ws.workspaces().find((w) => w.id === ws.selectedId())
    const cwd = focused?.cwd
    if (!cwd) {
      setFiles([])
      return
    }
    if (cwd === lastCwd && files().length > 0) return
    lastCwd = cwd
    setLoading(true)
    listAllFiles(cwd)
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }

  onMount(() => {
    load()
    const interval = setInterval(load, 30_000)
    onCleanup(() => clearInterval(interval))
  })

  const refresh = () => {
    lastCwd = ""
    load()
  }

  const ctx: FileIndexCtx = { files, loading, refresh }

  return <Ctx.Provider value={ctx}>{props.children}</Ctx.Provider>
}

export function useFileIndex(): FileIndexCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useFileIndex must be used within FileIndexProvider")
  return ctx
}
