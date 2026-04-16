import { z } from "zod"

export const EditorTokenColor = z.object({
  token: z.string().min(1),
  foreground: z
    .string()
    .regex(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i)
    .optional(),
  fontStyle: z.enum(["normal", "italic", "bold", "underline"]).optional(),
})

export const EditorTheme = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  kind: z.enum(["dark", "light"]),
  colors: z.record(z.string().regex(/^#([0-9a-f]{6}|[0-9a-f]{8})$/i)),
  tokenColors: z.array(EditorTokenColor),
})

export type EditorTheme = z.infer<typeof EditorTheme>

const BUILTIN: EditorTheme[] = [
  {
    id: "coda-dark",
    name: "Coda Dark",
    kind: "dark",
    colors: {
      "editor.background": "#0a0a0b",
      "editor.foreground": "#e8e8ec",
      "editor.lineHighlightBackground": "#1a1a1d",
    },
    tokenColors: [
      { token: "keyword", foreground: "#ff6b1a", fontStyle: "bold" },
      { token: "string", foreground: "#3fb950" },
      { token: "comment", foreground: "#64646e", fontStyle: "italic" },
    ],
  },
  {
    id: "dracula",
    name: "Dracula",
    kind: "dark",
    colors: {
      "editor.background": "#282a36",
      "editor.foreground": "#f8f8f2",
      "editor.lineHighlightBackground": "#44475a",
    },
    tokenColors: [
      { token: "keyword", foreground: "#ff79c6" },
      { token: "string", foreground: "#f1fa8c" },
      { token: "comment", foreground: "#6272a4", fontStyle: "italic" },
    ],
  },
  {
    id: "one-dark-pro",
    name: "One Dark Pro",
    kind: "dark",
    colors: {
      "editor.background": "#282c34",
      "editor.foreground": "#abb2bf",
      "editor.lineHighlightBackground": "#2c313c",
    },
    tokenColors: [
      { token: "keyword", foreground: "#c678dd" },
      { token: "string", foreground: "#98c379" },
      { token: "comment", foreground: "#5c6370", fontStyle: "italic" },
    ],
  },
  {
    id: "coda-light",
    name: "Coda Light",
    kind: "light",
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#1a1a1d",
      "editor.lineHighlightBackground": "#f4f4f6",
    },
    tokenColors: [
      { token: "keyword", foreground: "#b84300", fontStyle: "bold" },
      { token: "string", foreground: "#237d30" },
      { token: "comment", foreground: "#64646e", fontStyle: "italic" },
    ],
  },
]

export class ThemeCatalog {
  private themes = new Map<string, EditorTheme>()

  constructor(themes: EditorTheme[] = BUILTIN) {
    for (const t of themes) this.register(t)
  }

  register(theme: EditorTheme): EditorTheme {
    const parsed = EditorTheme.parse(theme)
    this.themes.set(parsed.id, parsed)
    return parsed
  }

  get(id: string): EditorTheme | undefined {
    return this.themes.get(id)
  }

  list(): EditorTheme[] {
    return Array.from(this.themes.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  byKind(kind: EditorTheme["kind"]): EditorTheme[] {
    return this.list().filter((t) => t.kind === kind)
  }
}

export function builtinThemes(): EditorTheme[] {
  return BUILTIN.map((t) => EditorTheme.parse(t))
}
