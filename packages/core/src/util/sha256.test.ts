import { describe, expect, test } from "bun:test"
import { hmacSha256Hex, randomHex, sha256Hex, timingSafeEqualHex } from "./sha256"

describe("sha256Hex", () => {
  test("matches known vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    )
    expect(sha256Hex("The quick brown fox jumps over the lazy dog")).toBe(
      "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
    )
  })

  test("handles multi-block input", () => {
    const long = "a".repeat(1000)
    expect(sha256Hex(long)).toBe("41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3")
  })
})

describe("hmacSha256Hex", () => {
  test("RFC 4231 test case 1", () => {
    const key = new Uint8Array([
      0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b, 0x0b,
      0x0b, 0x0b, 0x0b, 0x0b, 0x0b,
    ])
    expect(hmacSha256Hex(key, "Hi There")).toBe(
      "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
    )
  })

  test("deterministic", () => {
    const a = hmacSha256Hex("k", "m")
    const b = hmacSha256Hex("k", "m")
    expect(a).toBe(b)
    expect(a).not.toBe(hmacSha256Hex("k", "n"))
  })
})

describe("randomHex", () => {
  test("produces unique values", () => {
    const a = randomHex(16)
    const b = randomHex(16)
    expect(a).toHaveLength(32)
    expect(a).not.toBe(b)
  })
})

describe("timingSafeEqualHex", () => {
  test("rejects mismatched lengths", () => {
    expect(timingSafeEqualHex("ab", "abc")).toBe(false)
  })
  test("accepts equal strings", () => {
    expect(timingSafeEqualHex("deadbeef", "deadbeef")).toBe(true)
  })
  test("rejects mismatched content", () => {
    expect(timingSafeEqualHex("deadbeef", "deadbeee")).toBe(false)
  })
})
