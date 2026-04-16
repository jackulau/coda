import { describe, expect, test } from "bun:test"
import { PrView } from "@coda/core/github"

describe("PR context (E1)", () => {
  test("PrView schema accepts a minimal valid PR", () => {
    const parsed = PrView.parse({
      number: 1,
      state: "open",
      title: "A fix",
      headSha: "abc1234",
      baseSha: "def5678",
      author: "someone",
      files: [],
    })
    expect(parsed.number).toBe(1)
    expect(parsed.state).toBe("open")
    expect(parsed.files.length).toBe(0)
  })

  test("PrView rejects invalid state", () => {
    expect(() =>
      PrView.parse({
        number: 1,
        state: "weird",
        title: "x",
        headSha: "abc1234",
        baseSha: "def5678",
        author: "me",
        files: [],
      }),
    ).toThrow()
  })

  test("PrView rejects bad sha format", () => {
    expect(() =>
      PrView.parse({
        number: 1,
        state: "open",
        title: "x",
        headSha: "nope",
        baseSha: "def5678",
        author: "me",
        files: [],
      }),
    ).toThrow()
  })
})
