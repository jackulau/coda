// Pure-JS SHA-256 (isomorphic). Used where sync hashing is required
// and we cannot rely on node:crypto (browser/Tauri WebView bundle).

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n))
}

// Safe index helpers — TS strict `noUncheckedIndexedAccess` forces
// `number | undefined` on typed-array access, but the SHA-256 loops always
// stay in range. These helpers keep biome happy without `!`.
function u32(arr: Uint32Array, i: number): number {
  return arr[i] as number
}
function u8(arr: Uint8Array, i: number): number {
  return arr[i] as number
}

export function sha256(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8
  const padLen = (data.length + 9 + 63) & ~63
  const padded = new Uint8Array(padLen)
  padded.set(data)
  padded[data.length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(padLen - 4, bitLen >>> 0, false)
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000) >>> 0, false)

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])

  const w = new Uint32Array(64)
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false)
    for (let i = 16; i < 64; i++) {
      const w15 = u32(w, i - 15)
      const w2 = u32(w, i - 2)
      const s0 = rotr(7, w15) ^ rotr(18, w15) ^ (w15 >>> 3)
      const s1 = rotr(17, w2) ^ rotr(19, w2) ^ (w2 >>> 10)
      w[i] = (u32(w, i - 16) + s0 + u32(w, i - 7) + s1) >>> 0
    }
    let a = u32(h, 0)
    let b = u32(h, 1)
    let c = u32(h, 2)
    let d = u32(h, 3)
    let e = u32(h, 4)
    let f = u32(h, 5)
    let g = u32(h, 6)
    let hh = u32(h, 7)
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + S1 + ch + u32(K, i) + u32(w, i)) >>> 0
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)
      const mj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + mj) >>> 0
      hh = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    h[0] = (u32(h, 0) + a) >>> 0
    h[1] = (u32(h, 1) + b) >>> 0
    h[2] = (u32(h, 2) + c) >>> 0
    h[3] = (u32(h, 3) + d) >>> 0
    h[4] = (u32(h, 4) + e) >>> 0
    h[5] = (u32(h, 5) + f) >>> 0
    h[6] = (u32(h, 6) + g) >>> 0
    h[7] = (u32(h, 7) + hh) >>> 0
  }

  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, u32(h, i), false)
  return out
}

export function sha256Hex(input: string | Uint8Array): string {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input
  const hash = sha256(data)
  let hex = ""
  for (const b of hash) hex += b.toString(16).padStart(2, "0")
  return hex
}

export function hmacSha256Hex(key: string | Uint8Array, body: string | Uint8Array): string {
  const enc = new TextEncoder()
  let keyBytes = typeof key === "string" ? enc.encode(key) : key
  if (keyBytes.length > 64) keyBytes = sha256(keyBytes)
  const padded = new Uint8Array(64)
  padded.set(keyBytes)
  const outer = new Uint8Array(64)
  const inner = new Uint8Array(64)
  for (let i = 0; i < 64; i++) {
    outer[i] = u8(padded, i) ^ 0x5c
    inner[i] = u8(padded, i) ^ 0x36
  }
  const bodyBytes = typeof body === "string" ? enc.encode(body) : body
  const innerMsg = new Uint8Array(64 + bodyBytes.length)
  innerMsg.set(inner)
  innerMsg.set(bodyBytes, 64)
  const innerHash = sha256(innerMsg)
  const outerMsg = new Uint8Array(64 + 32)
  outerMsg.set(outer)
  outerMsg.set(innerHash, 64)
  const finalHash = sha256(outerMsg)
  let hex = ""
  for (const b of finalHash) hex += b.toString(16).padStart(2, "0")
  return hex
}

export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  globalThis.crypto.getRandomValues(buf)
  let hex = ""
  for (const b of buf) hex += b.toString(16).padStart(2, "0")
  return hex
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
