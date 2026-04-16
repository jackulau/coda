import { describe, expect, test } from "bun:test"
import { computeSignature, createSignatureStore } from "./signature"

const base = {
  name: "sidebar",
  viewport: { width: 1440, height: 900 },
  theme: "dark" as const,
  dpr: 2,
  domMarkers: ["project:alpha", "workspace:metrics-explorer"],
}

describe("computeSignature", () => {
  test("deterministic for identical input", () => {
    expect(computeSignature(base).hash).toBe(computeSignature(base).hash)
  })

  test("order of domMarkers does not affect hash", () => {
    const a = computeSignature(base)
    const b = computeSignature({ ...base, domMarkers: [...base.domMarkers].reverse() })
    expect(a.hash).toBe(b.hash)
  })

  test("changing viewport changes key and hash", () => {
    const a = computeSignature(base)
    const b = computeSignature({ ...base, viewport: { width: 1920, height: 1080 } })
    expect(a.key).not.toBe(b.key)
    expect(a.hash).not.toBe(b.hash)
  })

  test("changing theme changes key and hash", () => {
    const a = computeSignature(base)
    const b = computeSignature({ ...base, theme: "light" })
    expect(a.key).not.toBe(b.key)
  })
})

describe("SignatureStore", () => {
  test("diff returns missing-baseline when no prior entry", () => {
    const store = createSignatureStore()
    const sig = computeSignature(base)
    expect(store.diff(sig.key, sig)).toBe("missing-baseline")
  })

  test("diff returns match when hashes equal", () => {
    const sig = computeSignature(base)
    const store = createSignatureStore([sig])
    expect(store.diff(sig.key, sig)).toBe("match")
  })

  test("diff returns mismatch when DOM markers differ", () => {
    const sig = computeSignature(base)
    const store = createSignatureStore([sig])
    const candidate = computeSignature({ ...base, domMarkers: ["project:alpha", "different"] })
    expect(candidate.key).toBe(sig.key)
    expect(store.diff(sig.key, candidate)).toBe("mismatch")
  })
})
