// Bridges KeyboardEvent -> ShortcutRegistry -> registered command handler.
// Installs a single window-level keydown listener so every chord goes
// through the registry (no ad-hoc per-component listeners).

import { type Shortcut, ShortcutRegistry } from "@coda/core/shortcuts/registry"

export type CommandId =
  | "coda.palette.open"
  | "coda.workspace.open"
  | "coda.tab.close"
  | "coda.tab.save"
  | "coda.sidebar.toggle"
  | "coda.file.reveal"
  | "coda.workspace.remove"

export type HandlerMap = Partial<Record<CommandId, () => void>>

const DEFAULT_SHORTCUTS: Shortcut[] = [
  {
    id: "coda.palette.open",
    defaultChord: "Mod+P",
    description: "Open command palette",
    scope: "global",
  },
  {
    id: "coda.workspace.open",
    defaultChord: "Mod+O",
    description: "Open folder…",
    scope: "global",
  },
  {
    id: "coda.tab.save",
    defaultChord: "Mod+S",
    description: "Save current file",
    scope: "global",
  },
  {
    id: "coda.tab.close",
    defaultChord: "Mod+W",
    description: "Close current tab",
    scope: "global",
  },
  {
    id: "coda.sidebar.toggle",
    defaultChord: "Mod+B",
    description: "Toggle sidebar",
    scope: "global",
  },
  {
    id: "coda.file.reveal",
    defaultChord: "Mod+Shift+R",
    description: "Reveal in Finder",
    scope: "global",
  },
  {
    id: "coda.workspace.remove",
    defaultChord: "Mod+Shift+W",
    description: "Remove workspace",
    scope: "global",
  },
]

export interface ShortcutBridgeOptions {
  registry?: ShortcutRegistry
  /** @internal test hook: skip looking at navigator.platform. */
  platform?: "mac" | "win" | "linux"
}

export interface ShortcutBridge {
  registry: ShortcutRegistry
  /** Convert a KeyboardEvent to the registry chord string. */
  eventToChord(e: KeyboardEvent): string
  /** Dispatch a DOM keydown through the registry; returns true if a
   *  command ran. */
  dispatch(e: KeyboardEvent, handlers: HandlerMap): boolean
  /** Install a window-level listener. Returns a cleanup. */
  install(handlers: () => HandlerMap): () => void
  list(): ReturnType<ShortcutRegistry["list"]>
}

function detectPlatform(): "mac" | "win" | "linux" {
  if (typeof navigator === "undefined") return "linux"
  const p = navigator.platform.toLowerCase()
  if (p.includes("mac")) return "mac"
  if (p.includes("win")) return "win"
  return "linux"
}

function keyLabel(key: string): string {
  if (key === " ") return "Space"
  if (key.length === 1) return key.toUpperCase()
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
}

export function createShortcutBridge(opts: ShortcutBridgeOptions = {}): ShortcutBridge {
  const platform = opts.platform ?? detectPlatform()
  const registry = opts.registry ?? new ShortcutRegistry(platform)
  if (!opts.registry) {
    for (const s of DEFAULT_SHORTCUTS) registry.define(s)
  }

  function eventToChord(e: KeyboardEvent): string {
    const parts: string[] = []
    if (platform === "mac") {
      if (e.metaKey) parts.push("Cmd")
      if (e.ctrlKey) parts.push("Ctrl")
    } else {
      if (e.ctrlKey) parts.push("Ctrl")
    }
    if (e.altKey) parts.push("Alt")
    if (e.shiftKey) parts.push("Shift")
    const k = e.key
    if (k === "Meta" || k === "Control" || k === "Alt" || k === "Shift") {
      return ""
    }
    parts.push(keyLabel(k))
    return parts.join("+")
  }

  /**
   * Return true if the event originated inside a text-entry control that
   * should handle its own keystrokes. Prevents a global Cmd+S from
   * firing "save file" while the user is typing in a sidebar rename
   * input, a command-palette search field, etc. CodeMirror has its own
   * keymap that will grab Mod+S at the editor level before the window
   * listener sees it, so the editor itself still saves as expected.
   */
  function shouldSkipForTarget(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement | null
    if (!target) return false
    const tag = target.tagName
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
    // Walk up for contenteditable. Check the .contentEditable property
    // first (most browsers) and fall back to the attribute (happy-dom).
    let el: HTMLElement | null = target
    while (el) {
      const prop = (el as HTMLElement & { contentEditable?: string }).contentEditable
      if (prop === "true" || prop === "plaintext-only") return true
      const attr = el.getAttribute?.("contenteditable")
      if (attr === "" || attr === "true" || attr === "plaintext-only") return true
      el = el.parentElement
    }
    return false
  }

  function dispatch(e: KeyboardEvent, handlers: HandlerMap): boolean {
    if (shouldSkipForTarget(e)) return false
    const chord = eventToChord(e)
    if (!chord) return false
    const id = registry.resolve(chord, "global") as CommandId | null
    if (!id) return false
    const fn = handlers[id]
    if (!fn) return false
    e.preventDefault()
    fn()
    return true
  }

  // Guard against double-install (e.g. HMR or an accidental re-mount):
  // only one window-level listener is ever active per bridge instance.
  let activeCleanup: (() => void) | null = null

  function install(getHandlers: () => HandlerMap): () => void {
    if (activeCleanup) return activeCleanup
    const listener = (e: KeyboardEvent) => {
      dispatch(e, getHandlers())
    }
    window.addEventListener("keydown", listener)
    const cleanup = () => {
      window.removeEventListener("keydown", listener)
      if (activeCleanup === cleanup) activeCleanup = null
    }
    activeCleanup = cleanup
    return cleanup
  }

  return {
    registry,
    eventToChord,
    dispatch,
    install,
    list: () => registry.list(),
  }
}
