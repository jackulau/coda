export type Platform = "mac" | "win" | "linux"

export interface Shortcut {
  id: string
  defaultChord: string
  description: string
  scope: "global" | "editor" | "palette" | "terminal"
}

export interface ShortcutBinding extends Shortcut {
  effectiveChord: string
  source: "default" | "user-override"
}

export interface ConflictReport {
  chord: string
  ids: string[]
}

export class ShortcutRegistry {
  private readonly defaults = new Map<string, Shortcut>()
  private readonly overrides = new Map<string, string>()

  constructor(private readonly platform: Platform) {}

  define(shortcut: Shortcut): void {
    if (this.defaults.has(shortcut.id)) {
      throw new Error(`shortcut id already defined: ${shortcut.id}`)
    }
    this.defaults.set(shortcut.id, shortcut)
  }

  override(id: string, chord: string | null): void {
    if (!this.defaults.has(id)) throw new Error(`unknown shortcut id: ${id}`)
    if (chord === null) {
      this.overrides.delete(id)
    } else {
      this.overrides.set(id, normalizeChord(chord, this.platform))
    }
  }

  list(): ShortcutBinding[] {
    const out: ShortcutBinding[] = []
    for (const s of this.defaults.values()) {
      const override = this.overrides.get(s.id)
      out.push({
        ...s,
        effectiveChord: override ?? normalizeChord(s.defaultChord, this.platform),
        source: override ? "user-override" : "default",
      })
    }
    return out.sort((a, b) => a.id.localeCompare(b.id))
  }

  conflicts(): ConflictReport[] {
    const byChord = new Map<string, Set<string>>()
    for (const b of this.list()) {
      const key = `${b.scope}:${b.effectiveChord}`
      const set = byChord.get(key) ?? new Set()
      set.add(b.id)
      byChord.set(key, set)
    }
    const out: ConflictReport[] = []
    for (const [key, ids] of byChord) {
      if (ids.size > 1) {
        const chord = key.split(":")[1] ?? ""
        out.push({ chord, ids: Array.from(ids).sort() })
      }
    }
    return out
  }

  resolve(chord: string, scope: Shortcut["scope"]): string | null {
    const norm = normalizeChord(chord, this.platform)
    for (const b of this.list()) {
      if ((b.scope === scope || b.scope === "global") && b.effectiveChord === norm) {
        return b.id
      }
    }
    return null
  }
}

const TOKEN_ALIASES: Record<string, string> = {
  mod: "Mod",
  cmd: "Mod",
  command: "Mod",
  meta: "Mod",
  ctrl: "Ctrl",
  control: "Ctrl",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
}

const ORDER = ["Mod", "Ctrl", "Alt", "Shift"]

export function normalizeChord(chord: string, platform: Platform): string {
  const tokens = chord.split("+").map((t) => t.trim())
  if (tokens.length === 0) throw new Error(`invalid chord: ${chord}`)

  const modifiers = new Set<string>()
  let key = ""

  for (const t of tokens) {
    const lower = t.toLowerCase()
    if (lower in TOKEN_ALIASES) {
      modifiers.add(TOKEN_ALIASES[lower] as string)
    } else if (t.length > 0) {
      key = t.length === 1 ? t.toUpperCase() : capitalize(t)
    }
  }

  if (!key) throw new Error(`chord missing key: ${chord}`)

  const platformMods = Array.from(modifiers).map((m) => {
    if (m === "Mod") return platform === "mac" ? "Cmd" : "Ctrl"
    return m
  })

  const sorted = ORDER.flatMap((m) =>
    platformMods.includes(m === "Mod" ? (platform === "mac" ? "Cmd" : "Ctrl") : m)
      ? [m === "Mod" ? (platform === "mac" ? "Cmd" : "Ctrl") : m]
      : [],
  )
  const dedup = Array.from(new Set(sorted))

  return [...dedup, key].join("+")
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}
