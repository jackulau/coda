export interface ThemeDefinition {
  id: string
  label: string
  kind: "dark" | "light"
  editorPalette: {
    background: string
    foreground: string
    accent: string
  }
  terminalPalette: {
    background: string
    foreground: string
  }
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "coda-dark",
    label: "Coda Dark",
    kind: "dark",
    editorPalette: { background: "#0b0b0d", foreground: "#f5f5f7", accent: "#ff7a1a" },
    terminalPalette: { background: "#0b0b0d", foreground: "#f5f5f7" },
  },
  {
    id: "monokai",
    label: "Monokai",
    kind: "dark",
    editorPalette: { background: "#272822", foreground: "#f8f8f2", accent: "#a6e22e" },
    terminalPalette: { background: "#272822", foreground: "#f8f8f2" },
  },
  {
    id: "dracula",
    label: "Dracula",
    kind: "dark",
    editorPalette: { background: "#282a36", foreground: "#f8f8f2", accent: "#bd93f9" },
    terminalPalette: { background: "#282a36", foreground: "#f8f8f2" },
  },
  {
    id: "one-dark-pro",
    label: "One Dark Pro",
    kind: "dark",
    editorPalette: { background: "#1e2127", foreground: "#abb2bf", accent: "#61afef" },
    terminalPalette: { background: "#1e2127", foreground: "#abb2bf" },
  },
  {
    id: "github-light",
    label: "GitHub Light",
    kind: "light",
    editorPalette: { background: "#ffffff", foreground: "#24292e", accent: "#0366d6" },
    terminalPalette: { background: "#ffffff", foreground: "#24292e" },
  },
]

export function findTheme(id: string): ThemeDefinition | undefined {
  return THEMES.find((t) => t.id === id)
}
