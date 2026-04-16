import { describe, expect, test } from "bun:test"
import { GlobalErrorRecorder } from "./global-error-handler"

describe("GlobalErrorRecorder (J1)", () => {
  test("captures error + unhandledrejection", () => {
    const r = new GlobalErrorRecorder()
    r.capture("TypeError", "error", 1000)
    r.capture("NetworkError", "unhandledrejection", 2000)
    expect(r.list().length).toBe(2)
  })

  test("dedupes identical consecutive errors within 500ms", () => {
    const r = new GlobalErrorRecorder()
    r.capture("same", "error", 1000)
    r.capture("same", "error", 1400)
    expect(r.list().length).toBe(1)
  })

  test("does not dedupe after the 500ms window", () => {
    const r = new GlobalErrorRecorder()
    r.capture("same", "error", 1000)
    r.capture("same", "error", 1600)
    expect(r.list().length).toBe(2)
  })
})
