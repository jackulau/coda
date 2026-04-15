import type { ProjectInfo } from "@coda/core/project"
import type { AgentStatus, WorkspaceInfo } from "@coda/core/workspace"
import { type Component, type JSX, createContext, createSignal, useContext } from "solid-js"

export interface WorkspaceUiRow extends WorkspaceInfo {
  agentStatus: AgentStatus
  additions: number
  deletions: number
}

const SUPERSET_ID = "00000000-0000-0000-0000-000000000001"
const CODA_ID = "00000000-0000-0000-0000-000000000002"

const DEMO_PROJECTS: ProjectInfo[] = [
  {
    id: SUPERSET_ID,
    name: "superset",
    rootPath: "~/code/superset",
    expanded: true,
    createdAt: Date.now(),
  },
  {
    id: CODA_ID,
    name: "coda",
    rootPath: "~/code/coda",
    expanded: true,
    createdAt: Date.now(),
  },
]

const DEMO_WORKSPACES: WorkspaceUiRow[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    projectId: SUPERSET_ID,
    name: "metrics-explorer",
    cwd: "~/code/superset/wt/metrics-explorer",
    branch: "feat/metrics-explorer",
    baseBranch: "main",
    pinned: true,
    createdAt: Date.now(),
    agentStatus: "running",
    additions: 412,
    deletions: 87,
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    projectId: SUPERSET_ID,
    name: "perf-budget",
    cwd: "~/code/superset/wt/perf-budget",
    branch: "fix/perf-budget",
    baseBranch: "main",
    pinned: false,
    createdAt: Date.now(),
    agentStatus: "awaiting-input",
    additions: 18,
    deletions: 3,
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    projectId: CODA_ID,
    name: "shell-rebuild",
    cwd: "~/code/coda/wt/shell-rebuild",
    branch: "feat/shell-rebuild",
    baseBranch: "main",
    pinned: true,
    createdAt: Date.now(),
    agentStatus: "idle",
    additions: 1240,
    deletions: 412,
  },
]

interface WorkspaceCtx {
  projects: () => ProjectInfo[]
  workspaces: () => WorkspaceUiRow[]
  workspacesForProject: (projectId: string) => WorkspaceUiRow[]
  selectWorkspace: (id: string) => void
  selectedId: () => string | null
}

const Ctx = createContext<WorkspaceCtx>()

export const WorkspaceProvider: Component<{ children: JSX.Element }> = (props) => {
  const [projects] = createSignal<ProjectInfo[]>(DEMO_PROJECTS)
  const [workspaces] = createSignal<WorkspaceUiRow[]>(DEMO_WORKSPACES)
  const [selectedId, setSelectedId] = createSignal<string | null>(DEMO_WORKSPACES[0]?.id ?? null)

  const ctx: WorkspaceCtx = {
    projects,
    workspaces,
    workspacesForProject: (projectId) => workspaces().filter((w) => w.projectId === projectId),
    selectWorkspace: (id) => setSelectedId(id),
    selectedId,
  }
  return <Ctx.Provider value={ctx}>{props.children}</Ctx.Provider>
}

export function useWorkspaces(): WorkspaceCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error("useWorkspaces must be used within WorkspaceProvider")
  return v
}
