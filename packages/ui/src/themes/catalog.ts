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
    id: "vesper",
    label: "Vesper",
    kind: "dark",
    editorPalette: { background: "#101010", foreground: "#b0b0b0", accent: "#FFC799" },
    terminalPalette: { background: "#101010", foreground: "#b0b0b0" },
  },
  {
    id: "oc-1",
    label: "OC-1",
    kind: "dark",
    editorPalette: { background: "#0a0a0b", foreground: "#e8e8ec", accent: "#ff6b1a" },
    terminalPalette: { background: "#0a0a0b", foreground: "#e8e8ec" },
  },
  {
    id: "oc-2",
    label: "OC-2",
    kind: "dark",
    editorPalette: { background: "#1a1a2e", foreground: "#e0e0f0", accent: "#7c3aed" },
    terminalPalette: { background: "#1a1a2e", foreground: "#e0e0f0" },
  },
  {
    id: "aura",
    label: "Aura",
    kind: "dark",
    editorPalette: { background: "#15141b", foreground: "#edecee", accent: "#a277ff" },
    terminalPalette: { background: "#15141b", foreground: "#edecee" },
  },
  {
    id: "ayu",
    label: "Ayu",
    kind: "dark",
    editorPalette: { background: "#0b0e14", foreground: "#bfbdb6", accent: "#e6b450" },
    terminalPalette: { background: "#0b0e14", foreground: "#bfbdb6" },
  },
  {
    id: "carbonfox",
    label: "Carbonfox",
    kind: "dark",
    editorPalette: { background: "#161616", foreground: "#f2f4f8", accent: "#78a9ff" },
    terminalPalette: { background: "#161616", foreground: "#f2f4f8" },
  },
  {
    id: "catppuccin",
    label: "Catppuccin",
    kind: "dark",
    editorPalette: { background: "#1e1e2e", foreground: "#cdd6f4", accent: "#cba6f7" },
    terminalPalette: { background: "#1e1e2e", foreground: "#cdd6f4" },
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
    id: "nord",
    label: "Nord",
    kind: "dark",
    editorPalette: { background: "#2e3440", foreground: "#d8dee9", accent: "#88c0d0" },
    terminalPalette: { background: "#2e3440", foreground: "#d8dee9" },
  },
  {
    id: "night-owl",
    label: "Night Owl",
    kind: "dark",
    editorPalette: { background: "#011627", foreground: "#d6deeb", accent: "#7fdbca" },
    terminalPalette: { background: "#011627", foreground: "#d6deeb" },
  },
  {
    id: "one-dark-pro",
    label: "One Dark Pro",
    kind: "dark",
    editorPalette: { background: "#1e2127", foreground: "#abb2bf", accent: "#61afef" },
    terminalPalette: { background: "#1e2127", foreground: "#abb2bf" },
  },
  {
    id: "shades-of-purple",
    label: "Shades of Purple",
    kind: "dark",
    editorPalette: { background: "#2d2b55", foreground: "#e0def4", accent: "#fad000" },
    terminalPalette: { background: "#2d2b55", foreground: "#e0def4" },
  },
  {
    id: "solarized",
    label: "Solarized",
    kind: "dark",
    editorPalette: { background: "#002b36", foreground: "#839496", accent: "#268bd2" },
    terminalPalette: { background: "#002b36", foreground: "#839496" },
  },
  {
    id: "tokyonight",
    label: "Tokyonight",
    kind: "dark",
    editorPalette: { background: "#1a1b26", foreground: "#a9b1d6", accent: "#7aa2f7" },
    terminalPalette: { background: "#1a1b26", foreground: "#a9b1d6" },
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
