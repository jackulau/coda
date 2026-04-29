import { type Component, type JSX, createContext, createSignal, useContext } from "solid-js"
import type { AgentKind } from "../components/agent-logos"

export interface TerminalTab {
  id: string
  kind: AgentKind
  title: string
  /** Canvas-mode position/size. Ignored when `canvasMode = false`. */
  x: number
  y: number
  w: number
  h: number
}

interface TermTabsCtx {
  tabs: () => TerminalTab[]
  activeId: () => string | null
  /** Canvas pan / zoom (only meaningful in canvas mode). */
  pan: () => { x: number; y: number }
  zoom: () => number
  setPan: (p: { x: number; y: number }) => void
  setZoom: (z: number) => void
  addTab: (kind: AgentKind) => string
  closeTab: (id: string) => void
  activate: (id: string) => void
  updateTab: (id: string, patch: Partial<TerminalTab>) => void
  resetLayout: () => void
}

const Ctx = createContext<TermTabsCtx>()

let seq = 0
const nextId = () => `term-${++seq}-${Date.now().toString(36)}`

const DEFAULT_SIZE = { w: 520, h: 320 }

function titleFor(kind: AgentKind): string {
  switch (kind) {
    case "shell":
      return "shell"
    case "claude":
      return "claude"
    case "codex":
      return "codex"
    case "gemini":
      return "gemini"
    case "cursor":
      return "cursor"
  }
}

export const TerminalTabsProvider: Component<{ children: JSX.Element }> = (props) => {
  const initial: TerminalTab = {
    id: nextId(),
    kind: "shell",
    title: titleFor("shell"),
    x: 40,
    y: 40,
    w: DEFAULT_SIZE.w,
    h: DEFAULT_SIZE.h,
  }
  const [tabs, setTabs] = createSignal<TerminalTab[]>([initial])
  const [activeId, setActiveId] = createSignal<string | null>(initial.id)
  const [pan, setPan] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 })
  const [zoom, setZoom] = createSignal<number>(1)

  const ctx: TermTabsCtx = {
    tabs,
    activeId,
    pan,
    zoom,
    setPan,
    setZoom,
    addTab: (kind) => {
      const id = nextId()
      const offset = tabs().length * 28
      setTabs((prev) => [
        ...prev,
        {
          id,
          kind,
          title: titleFor(kind),
          x: 40 + offset,
          y: 40 + offset,
          w: DEFAULT_SIZE.w,
          h: DEFAULT_SIZE.h,
        },
      ])
      setActiveId(id)
      return id
    },
    closeTab: (id) => {
      const next = tabs().filter((t) => t.id !== id)
      setTabs(next)
      if (activeId() === id) {
        setActiveId(next[next.length - 1]?.id ?? null)
      }
    },
    activate: (id) => setActiveId(id),
    updateTab: (id, patch) =>
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    resetLayout: () => {
      setPan({ x: 0, y: 0 })
      setZoom(1)
      setTabs((prev) =>
        prev.map((t, i) => ({
          ...t,
          x: 40 + i * 28,
          y: 40 + i * 28,
          w: DEFAULT_SIZE.w,
          h: DEFAULT_SIZE.h,
        })),
      )
    },
  }

  return <Ctx.Provider value={ctx}>{props.children}</Ctx.Provider>
}

export function useTerminalTabs(): TermTabsCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error("useTerminalTabs must be used inside TerminalTabsProvider")
  return v
}
