import type { ProjectInfo } from "@coda/core/project"
import type { AgentStatus, WorkspaceInfo } from "@coda/core/workspace"
import {
  type Component,
  type JSX,
  createContext,
  createSignal,
  onMount,
  useContext,
} from "solid-js"
import {
  type WorkspaceRecord,
  getLastSelectedWorkspace as ipcGetLastSelected,
  listWorkspaces as ipcListWorkspaces,
  openFolderDialog as ipcOpenFolderDialog,
  registerWorkspace as ipcRegisterWorkspace,
  setLastSelectedWorkspace as ipcSetLastSelected,
  unregisterWorkspace as ipcUnregisterWorkspace,
} from "../lib/ipc"

export interface WorkspaceUiRow extends WorkspaceInfo {
  agentStatus: AgentStatus
  additions: number
  deletions: number
}

export interface WorkspaceCtx {
  projects: () => ProjectInfo[]
  workspaces: () => WorkspaceUiRow[]
  workspacesForProject: (projectId: string) => WorkspaceUiRow[]
  selectWorkspace: (id: string) => void
  selectedId: () => string | null
  addWorkspaceFromDialog: () => Promise<WorkspaceRecord | null>
  removeWorkspace: (id: string) => Promise<void>
  isLoading: () => boolean
  loadError: () => string | null
  refresh: () => Promise<void>
}

const Ctx = createContext<WorkspaceCtx>()

function recordToProject(rec: WorkspaceRecord): ProjectInfo {
  return {
    id: rec.id,
    name: rec.name,
    rootPath: rec.rootPath,
    expanded: true,
    createdAt: Date.parse(rec.addedAt) || Date.now(),
  }
}

function recordToRow(rec: WorkspaceRecord): WorkspaceUiRow {
  return {
    id: rec.id,
    projectId: rec.id,
    name: rec.name,
    cwd: rec.rootPath,
    // Real git/agent status wiring is future work; start neutral.
    branch: "main",
    baseBranch: "main",
    pinned: false,
    createdAt: Date.parse(rec.addedAt) || Date.now(),
    agentStatus: "idle",
    additions: 0,
    deletions: 0,
  }
}

/**
 * Props allow tests to inject stub IPC fns. In production the WorkspaceProvider
 * uses the real IPC helpers from `../lib/ipc`.
 */
export interface WorkspaceProviderProps {
  children: JSX.Element
  /** @internal test hook */
  ipc?: {
    listWorkspaces?: typeof ipcListWorkspaces
    registerWorkspace?: typeof ipcRegisterWorkspace
    unregisterWorkspace?: typeof ipcUnregisterWorkspace
    getLastSelectedWorkspace?: typeof ipcGetLastSelected
    setLastSelectedWorkspace?: typeof ipcSetLastSelected
    openFolderDialog?: typeof ipcOpenFolderDialog
  }
  /** Skip the onMount hydrate — tests that want to control timing. */
  skipAutoHydrate?: boolean
}

export const WorkspaceProvider: Component<WorkspaceProviderProps> = (props) => {
  const ipc = {
    listWorkspaces: props.ipc?.listWorkspaces ?? ipcListWorkspaces,
    registerWorkspace: props.ipc?.registerWorkspace ?? ipcRegisterWorkspace,
    unregisterWorkspace: props.ipc?.unregisterWorkspace ?? ipcUnregisterWorkspace,
    getLastSelectedWorkspace: props.ipc?.getLastSelectedWorkspace ?? ipcGetLastSelected,
    setLastSelectedWorkspace: props.ipc?.setLastSelectedWorkspace ?? ipcSetLastSelected,
    openFolderDialog: props.ipc?.openFolderDialog ?? ipcOpenFolderDialog,
  }

  const [projects, setProjects] = createSignal<ProjectInfo[]>([])
  const [workspaces, setWorkspaces] = createSignal<WorkspaceUiRow[]>([])
  const [selectedId, setSelectedId] = createSignal<string | null>(null)
  const [isLoading, setLoading] = createSignal<boolean>(true)
  const [loadError, setLoadError] = createSignal<string | null>(null)

  async function refresh(): Promise<void> {
    setLoading(true)
    setLoadError(null)
    try {
      const records = await ipc.listWorkspaces()
      setProjects(records.map(recordToProject))
      setWorkspaces(records.map(recordToRow))
      const last = await ipc.getLastSelectedWorkspace()
      if (last && records.some((r) => r.id === last)) {
        setSelectedId(last)
      } else if (records.length > 0) {
        setSelectedId(records[0]?.id ?? null)
      } else {
        setSelectedId(null)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  if (!props.skipAutoHydrate) {
    onMount(() => {
      void refresh()
    })
  }

  async function addWorkspaceFromDialog(): Promise<WorkspaceRecord | null> {
    const picked = await ipc.openFolderDialog()
    if (!picked) return null
    const rec = await ipc.registerWorkspace(picked)
    await refresh()
    setSelectedId(rec.id)
    ipc.setLastSelectedWorkspace(rec.id).catch(() => {
      /* non-fatal: UI already shows new selection */
    })
    return rec
  }

  async function removeWorkspace(id: string): Promise<void> {
    await ipc.unregisterWorkspace(id)
    await refresh()
  }

  const ctx: WorkspaceCtx = {
    projects,
    workspaces,
    workspacesForProject: (projectId) => workspaces().filter((w) => w.projectId === projectId),
    selectWorkspace: (id) => {
      setSelectedId(id)
      ipc.setLastSelectedWorkspace(id).catch(() => {
        /* non-fatal: persistence is best-effort for the highlight */
      })
    },
    selectedId,
    addWorkspaceFromDialog,
    removeWorkspace,
    isLoading,
    loadError,
    refresh,
  }
  return <Ctx.Provider value={ctx}>{props.children}</Ctx.Provider>
}

export function useWorkspaces(): WorkspaceCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error("useWorkspaces must be used within WorkspaceProvider")
  return v
}
