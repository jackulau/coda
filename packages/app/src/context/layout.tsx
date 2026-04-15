import { type Component, type JSX, createContext, createSignal, useContext } from "solid-js"

const PERSIST_KEY = "coda.layout.v1"
const PERSIST_DEBOUNCE_MS = 500

export interface LayoutState {
  sidebarWidth: number
  rightRailWidth: number
  portsPanelHeight: number
  focusedWorkspaceId: string | null
  expandedProjects: Record<string, boolean>
}

const DEFAULT: LayoutState = {
  sidebarWidth: 280,
  rightRailWidth: 380,
  portsPanelHeight: 180,
  focusedWorkspaceId: null,
  expandedProjects: {},
}

function loadInitial(): LayoutState {
  if (typeof localStorage === "undefined") return DEFAULT
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return DEFAULT
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<LayoutState>) }
  } catch {
    return DEFAULT
  }
}

interface LayoutCtx {
  state: () => LayoutState
  setSidebarWidth: (n: number) => void
  setRightRailWidth: (n: number) => void
  setPortsPanelHeight: (n: number) => void
  focusWorkspace: (id: string | null) => void
  toggleProject: (id: string) => void
}

const Ctx = createContext<LayoutCtx>()

export const LayoutProvider: Component<{ children: JSX.Element }> = (props) => {
  const [state, setState] = createSignal<LayoutState>(loadInitial())

  let timer: ReturnType<typeof setTimeout> | undefined
  const persist = (next: LayoutState) => {
    setState(next)
    if (typeof localStorage === "undefined") return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      localStorage.setItem(PERSIST_KEY, JSON.stringify(next))
    }, PERSIST_DEBOUNCE_MS)
  }

  const ctx: LayoutCtx = {
    state,
    setSidebarWidth: (n) => persist({ ...state(), sidebarWidth: clamp(n, 220, 400) }),
    setRightRailWidth: (n) => persist({ ...state(), rightRailWidth: clamp(n, 300, 560) }),
    setPortsPanelHeight: (n) => persist({ ...state(), portsPanelHeight: Math.max(120, n) }),
    focusWorkspace: (id) => persist({ ...state(), focusedWorkspaceId: id }),
    toggleProject: (id) => {
      const cur = state()
      persist({
        ...cur,
        expandedProjects: { ...cur.expandedProjects, [id]: !cur.expandedProjects[id] },
      })
    },
  }

  return <Ctx.Provider value={ctx}>{props.children}</Ctx.Provider>
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

export function useLayout(): LayoutCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error("useLayout must be used within LayoutProvider")
  return v
}
