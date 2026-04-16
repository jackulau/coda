import { z } from "zod"

export const TerminalSettings = z.object({
  fontSize: z.number().int().min(10).max(24).default(14),
  cursorStyle: z.enum(["bar", "block", "underline"]).default("bar"),
  cursorBlink: z.boolean().default(false),
  scrollback: z.number().int().min(1000).max(100_000).default(10_000),
  startupCommand: z.string().max(4096).default(""),
  shell: z.string().default(""),
  bellSound: z.boolean().default(false),
  copyOnSelect: z.boolean().default(false),
  rightClickPaste: z.boolean().default(false),
})

export type TerminalSettings = z.infer<typeof TerminalSettings>

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = TerminalSettings.parse({})

export function mergeSettings(
  current: TerminalSettings,
  patch: Partial<TerminalSettings>,
): TerminalSettings {
  return TerminalSettings.parse({ ...current, ...patch })
}

export interface ScrollbackChange {
  trimmed: number
  finalLines: number
}

export function applyScrollbackChange(
  currentLines: number,
  buffered: number,
  nextLimit: number,
): ScrollbackChange {
  const trimmed = Math.max(0, buffered - nextLimit)
  const finalLines = Math.min(buffered, nextLimit)
  void currentLines
  return { trimmed, finalLines }
}

export function shouldWarnLargeScrollback(lines: number): boolean {
  return lines > 50_000
}

export function resolveStartupCommand(
  raw: string,
  prefersReducedMotion: boolean,
): { command: string; delayMs: number } {
  void prefersReducedMotion
  const trimmed = raw.trim()
  if (!trimmed) return { command: "", delayMs: 0 }
  const command = trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`
  return { command, delayMs: 0 }
}

export function effectiveCursorBlink(setting: boolean, prefersReducedMotion: boolean): boolean {
  if (prefersReducedMotion) return false
  return setting
}

export function platformDefaultShell(platform: NodeJS.Platform): string {
  if (platform === "win32") return "pwsh.exe"
  if (platform === "darwin") return "/bin/zsh"
  return "/bin/bash"
}

export function defaultRightClickPaste(platform: NodeJS.Platform): boolean {
  return platform === "win32"
}
