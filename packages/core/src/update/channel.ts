export type Channel = "stable" | "beta" | "canary"

export interface UpdateRelease {
  version: string
  channel: Channel
  arch: "x64" | "arm64"
  os: "darwin" | "linux" | "win32"
  publishedAt: number
}

export interface SemVer {
  major: number
  minor: number
  patch: number
  pre?: string
}

export function parseSemver(input: string): SemVer | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/.exec(input.trim())
  if (!m) return null
  return {
    major: Number.parseInt(m[1] ?? "0", 10),
    minor: Number.parseInt(m[2] ?? "0", 10),
    patch: Number.parseInt(m[3] ?? "0", 10),
    pre: m[4],
  }
}

export function compareSemver(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  if (a.patch !== b.patch) return a.patch - b.patch
  if (a.pre === undefined && b.pre !== undefined) return 1
  if (a.pre !== undefined && b.pre === undefined) return -1
  if (a.pre !== undefined && b.pre !== undefined) return a.pre.localeCompare(b.pre)
  return 0
}

const CHANNEL_RANK: Record<Channel, number> = { canary: 3, beta: 2, stable: 1 }

export interface SelectArgs {
  current: {
    version: string
    channel: Channel
    arch: "x64" | "arm64"
    os: "darwin" | "linux" | "win32"
  }
  available: UpdateRelease[]
}

export function selectUpdate(args: SelectArgs): UpdateRelease | null {
  const cur = parseSemver(args.current.version)
  if (!cur) return null

  const candidates = args.available.filter((r) => {
    if (r.os !== args.current.os) return false
    if (r.arch !== args.current.arch) return false
    if (CHANNEL_RANK[r.channel] > CHANNEL_RANK[args.current.channel]) return false
    const v = parseSemver(r.version)
    if (!v) return false
    return compareSemver(v, cur) > 0
  })

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    const va = parseSemver(a.version)
    const vb = parseSemver(b.version)
    if (!va || !vb) return 0
    const cmp = compareSemver(vb, va)
    if (cmp !== 0) return cmp
    return CHANNEL_RANK[b.channel] - CHANNEL_RANK[a.channel]
  })

  return candidates[0] ?? null
}
