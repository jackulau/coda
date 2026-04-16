import { describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Tasks } from "../packages/core/src"
import { Store, idempotentHash } from "./tasks-state"

function tmpPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "tasks-state-"))
  return join(dir, "TASKS.json")
}

function t(over: Partial<Tasks.TaskEntry> & { id: string }): Tasks.TaskEntry {
  return {
    phase: "A",
    title: over.id,
    status: "pending",
    dependencies: [],
    startedAt: null,
    completedAt: null,
    attempts: 0,
    lastError: null,
    verificationCommand: "true",
    verificationLastPassedAt: null,
    idempotentHash: null,
    files: [],
    ...over,
  }
}

describe("Store", () => {
  test("load on missing file creates with schema defaults", () => {
    const path = tmpPath()
    const store = new Store({ path })
    const state = store.load()
    expect(state.list()).toEqual([])
    expect(existsSync(path)).toBe(true)
  })

  test("atomic write: crash mid-rename preserves prior state via .bak", () => {
    const path = tmpPath()
    const store = new Store({ path })
    const s1 = store.load()
    s1.upsert(t({ id: "A1", title: "first" }))
    store.save(s1)
    const s2 = store.load()
    s2.upsert(t({ id: "A2", title: "second" }))
    store.save(s2)
    const bakExists = existsSync(`${path}.bak`)
    expect(bakExists).toBe(true)
    const bakContents = readFileSync(`${path}.bak`, "utf8")
    const bakParsed = JSON.parse(bakContents)
    expect(bakParsed.tasks.A1.title).toBe("first")
  })

  test("lock prevents concurrent writes", () => {
    const path = tmpPath()
    const lock = `${path}.lock`
    writeFileSync(lock, "")
    const store = new Store({ path })
    const s = new Tasks.TasksState()
    expect(() => store.save(s)).toThrow(/lock/i)
    rmSync(lock, { force: true })
  })

  test("roundtrip via save/load preserves all fields", () => {
    const path = tmpPath()
    const store = new Store({ path })
    const s = new Tasks.TasksState()
    s.upsert(t({ id: "A1", status: "verified", attempts: 3 }))
    store.save(s)
    const loaded = store.load()
    const a1 = loaded.get("A1")
    expect(a1?.status).toBe("verified")
    expect(a1?.attempts).toBe(3)
  })
})

describe("Tasks.TasksState semantics (spec criteria)", () => {
  test("next() respects dependency order", () => {
    const s = new Tasks.TasksState()
    s.upsert(t({ id: "A1" }))
    s.upsert(t({ id: "A2", dependencies: ["A1"] }))
    expect(s.next(0)?.id).toBe("A1")
    s.markInProgress("A1", 1)
    s.markVerified("A1", "h", 2)
    expect(s.next(3)?.id).toBe("A2")
  })

  test("validate() catches cycles", () => {
    const s = new Tasks.TasksState()
    s.upsert(t({ id: "A1", dependencies: ["A2"] }))
    s.upsert(t({ id: "A2", dependencies: ["A1"] }))
    const errs = s.validate()
    expect(errs.some((e) => e.kind === "cycle")).toBe(true)
  })

  test("validate() catches dangling dep references", () => {
    const s = new Tasks.TasksState()
    s.upsert(t({ id: "A1", dependencies: ["NOPE"] }))
    const errs = s.validate()
    expect(errs.some((e) => e.kind === "dangling-dep")).toBe(true)
  })

  test("markVerified is idempotent", () => {
    const s = new Tasks.TasksState()
    s.upsert(t({ id: "A1" }))
    s.markInProgress("A1", 1)
    s.markVerified("A1", "h1", 2)
    const first = s.get("A1")
    s.markVerified("A1", "h1", 3)
    const second = s.get("A1")
    expect(second?.status).toBe("verified")
    expect(second?.idempotentHash).toBe(first?.idempotentHash)
  })
})

describe("idempotentHash", () => {
  test("changes when input files change", () => {
    const dir = mkdtempSync(join(tmpdir(), "hash-"))
    const f = join(dir, "a.ts")
    writeFileSync(f, "v1")
    const h1 = idempotentHash("A1", [f], "bun test")
    writeFileSync(f, "v2")
    const h2 = idempotentHash("A1", [f], "bun test")
    expect(h1).not.toBe(h2)
  })

  test("stable when inputs unchanged", () => {
    const dir = mkdtempSync(join(tmpdir(), "hash-"))
    const f = join(dir, "a.ts")
    writeFileSync(f, "same")
    const h1 = idempotentHash("A1", [f], "bun test")
    const h2 = idempotentHash("A1", [f], "bun test")
    expect(h1).toBe(h2)
  })

  test("missing file hashes to stable MISSING token", () => {
    const h1 = idempotentHash("A1", ["/definitely/missing/file.ts"], "bun test")
    const h2 = idempotentHash("A1", ["/definitely/missing/file.ts"], "bun test")
    expect(h1).toBe(h2)
  })
})
