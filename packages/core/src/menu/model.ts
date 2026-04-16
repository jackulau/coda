export type MenuRole =
  | "new-workspace"
  | "open-project"
  | "close-workspace"
  | "quit"
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "find"
  | "find-in-files"
  | "toggle-sidebar"
  | "toggle-right-rail"
  | "open-command-palette"
  | "focus-terminal"
  | "reload"
  | "toggle-devtools"
  | "check-for-updates"
  | "about"

export interface MenuItem {
  id: string
  label: string
  role?: MenuRole
  shortcut?: string
  submenu?: MenuItem[]
  disabledWhen?: (ctx: MenuContext) => boolean
  visibleWhen?: (ctx: MenuContext) => boolean
  separator?: boolean
}

export interface MenuContext {
  hasFocusedWorkspace: boolean
  hasOpenPr: boolean
  hasSelection: boolean
  sidebarVisible: boolean
  rightRailVisible: boolean
  platform: "mac" | "win" | "linux"
}

export interface ResolvedMenuItem {
  id: string
  label: string
  shortcut?: string
  disabled: boolean
  visible: boolean
  separator: boolean
  submenu?: ResolvedMenuItem[]
}

export function resolveMenu(items: MenuItem[], ctx: MenuContext): ResolvedMenuItem[] {
  return items
    .filter((m) => m.visibleWhen?.(ctx) !== false)
    .map((m) => ({
      id: m.id,
      label: m.label,
      shortcut: m.shortcut,
      disabled: m.disabledWhen?.(ctx) ?? false,
      visible: true,
      separator: m.separator ?? false,
      submenu: m.submenu ? resolveMenu(m.submenu, ctx) : undefined,
    }))
}

export function defaultMenu(): MenuItem[] {
  return [
    {
      id: "coda",
      label: "Coda",
      submenu: [
        { id: "about", label: "About Coda", role: "about" },
        { id: "sep1", label: "", separator: true },
        { id: "check-update", label: "Check for Updates…", role: "check-for-updates" },
        { id: "sep2", label: "", separator: true },
        { id: "quit", label: "Quit Coda", role: "quit", shortcut: "Mod+Q" },
      ],
    },
    {
      id: "file",
      label: "File",
      submenu: [
        { id: "new-ws", label: "New Workspace…", role: "new-workspace", shortcut: "Mod+N" },
        { id: "open-project", label: "Open Project…", role: "open-project", shortcut: "Mod+O" },
        { id: "sep", label: "", separator: true },
        {
          id: "close-ws",
          label: "Close Workspace",
          role: "close-workspace",
          shortcut: "Mod+W",
          disabledWhen: (ctx) => !ctx.hasFocusedWorkspace,
        },
      ],
    },
    {
      id: "edit",
      label: "Edit",
      submenu: [
        { id: "undo", label: "Undo", role: "undo", shortcut: "Mod+Z" },
        { id: "redo", label: "Redo", role: "redo", shortcut: "Mod+Shift+Z" },
        { id: "sep", label: "", separator: true },
        {
          id: "cut",
          label: "Cut",
          role: "cut",
          shortcut: "Mod+X",
          disabledWhen: (ctx) => !ctx.hasSelection,
        },
        {
          id: "copy",
          label: "Copy",
          role: "copy",
          shortcut: "Mod+C",
          disabledWhen: (ctx) => !ctx.hasSelection,
        },
        { id: "paste", label: "Paste", role: "paste", shortcut: "Mod+V" },
        { id: "sep2", label: "", separator: true },
        { id: "find", label: "Find", role: "find", shortcut: "Mod+F" },
        {
          id: "find-in-files",
          label: "Find in Files",
          role: "find-in-files",
          shortcut: "Mod+Shift+F",
        },
      ],
    },
    {
      id: "view",
      label: "View",
      submenu: [
        {
          id: "cmd-palette",
          label: "Command Palette…",
          role: "open-command-palette",
          shortcut: "Mod+P",
        },
        { id: "sep", label: "", separator: true },
        {
          id: "toggle-sidebar",
          label: "Toggle Sidebar",
          role: "toggle-sidebar",
          shortcut: "Mod+B",
        },
        {
          id: "toggle-rail",
          label: "Toggle Right Rail",
          role: "toggle-right-rail",
          shortcut: "Mod+Shift+B",
        },
        { id: "sep2", label: "", separator: true },
        {
          id: "devtools",
          label: "Toggle Developer Tools",
          role: "toggle-devtools",
          shortcut: "Mod+Alt+I",
          visibleWhen: (ctx) => ctx.platform !== "mac" || true,
        },
      ],
    },
  ]
}
