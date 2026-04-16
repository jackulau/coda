import { sha256Hex } from "../util/sha256"

export interface VisualSignatureInput {
  name: string
  viewport: { width: number; height: number }
  theme: "dark" | "light"
  dpr: number
  domMarkers: string[]
}

export interface VisualSignature {
  key: string
  name: string
  hash: string
  recordedAt: number
}

export function computeSignature(input: VisualSignatureInput, now = Date.now()): VisualSignature {
  const canonical = canonicalize(input)
  const hash = sha256Hex(canonical).slice(0, 16)
  const key = `${input.name}@${input.viewport.width}x${input.viewport.height}@${input.dpr}x@${input.theme}`
  return { key, name: input.name, hash, recordedAt: now }
}

function canonicalize(input: VisualSignatureInput): string {
  return JSON.stringify({
    n: input.name,
    w: input.viewport.width,
    h: input.viewport.height,
    t: input.theme,
    d: input.dpr,
    m: [...input.domMarkers].sort(),
  })
}

export interface SignatureStore {
  get(key: string): VisualSignature | undefined
  upsert(sig: VisualSignature): void
  diff(key: string, candidate: VisualSignature): "match" | "missing-baseline" | "mismatch"
}

export function createSignatureStore(initial: VisualSignature[] = []): SignatureStore {
  const map = new Map(initial.map((s) => [s.key, s]))
  return {
    get(key) {
      return map.get(key)
    },
    upsert(sig) {
      map.set(sig.key, sig)
    },
    diff(key, candidate) {
      const baseline = map.get(key)
      if (!baseline) return "missing-baseline"
      return baseline.hash === candidate.hash ? "match" : "mismatch"
    },
  }
}
