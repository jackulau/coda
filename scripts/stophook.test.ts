import { describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Tasks } from "../packages/core/src"

const STOPHOOK = join(import.meta.dir, "stophook.ts")

interface RunResult {
  exit: number
  stdout: string
  stderr: string
}

async function runStophook(args: string[], env: Record<string, string> = {}): Promise<RunResult> {
  const proc = Bun.spawn(["bun", STOPHOOK, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  })
  const exit = await proc.exited
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  return { exit, stdout, stderr }
}

function freshTasksFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "stophook-"))
  return join(dir, "TASKS.json")
}

function seed(path: string, entries: Tasks.TaskEntry[]): void {
  const s = new Tasks.TasksState()
  for (const e of entries) s.upsert(e)
  writeFileSync(path, s.serialize())
}

const t = (over: Partial<Tasks.TaskEntry>): Tasks.TaskEntry => ({
  id: "A1",
  phase: "A",
  title: "t",
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
})

describe("stophook --plan", () => {
  test("emits plan JSON for known pending task", async () => {
    const path = freshTasksFile()
    seed(path, [t({ id: "A1", verificationCommand: "echo ok" })])
    const r = await runStophook(["--plan", "A1"], { CODA_TASKS_PATH: path })
    expect(r.exit).toBe(0)
    const line = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}")
    expect(line.kind).toBe("plan")
    expect(line.taskId).toBe("A1")
    expect(line.verification).toBe("echo ok")
    rmSync(path, { force: true })
  })

  test("advances attempts counter after plan", async () => {
    const path = freshTasksFile()
    seed(path, [t({ id: "A1" })])
    await runStophook(["--plan", "A1"], { CODA_TASKS_PATH: path })
    const state = Tasks.TasksState.deserialize(readFileSync(path, "utf8"))
    const task = state.get("A1")
    expect(task?.status).toBe("in_progress")
    expect(task?.attempts).toBe(1)
    rmSync(path, { force: true })
  })

  test("--plan with no ready task emits no-work", async () => {
    const path = freshTasksFile()
    seed(path, [t({ id: "A1", status: "verified" })])
    const r = await runStophook(["--plan"], { CODA_TASKS_PATH: path })
    const line = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}")
    expect(line.kind).toBe("no-work")
    rmSync(path, { force: true })
  })

  test("stop file halts loop", async () => {
    const path = freshTasksFile()
    const stopFile = `${path}.stop`
    writeFileSync(stopFile, "")
    seed(path, [t({ id: "A1" })])
    const r = await runStophook(["--plan"], {
      CODA_TASKS_PATH: path,
      CODA_STOP_FILE: stopFile,
    })
    const line = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}")
    expect(line.kind).toBe("halt")
    rmSync(path, { force: true })
    rmSync(stopFile, { force: true })
  })
})

describe("stophook --verify", () => {
  test("verification command exits 0 → task marked verified", async () => {
    const path = freshTasksFile()
    seed(path, [t({ id: "A1", verificationCommand: "exit 0" })])
    const r = await runStophook(["--verify", "A1"], { CODA_TASKS_PATH: path })
    expect(r.exit).toBe(0)
    const line = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}")
    expect(line.kind).toBe("verified")
    const state = Tasks.TasksState.deserialize(readFileSync(path, "utf8"))
    expect(state.get("A1")?.status).toBe("verified")
    rmSync(path, { force: true })
  })

  test("failing verification marks task failed with lastError", async () => {
    const path = freshTasksFile()
    seed(path, [
      t({
        id: "A1",
        verificationCommand: 'bash -c "echo nope 1>&2; exit 1"',
      }),
    ])
    const r = await runStophook(["--verify", "A1"], { CODA_TASKS_PATH: path })
    const line = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}")
    expect(line.kind).toBe("failed")
    const state = Tasks.TasksState.deserialize(readFileSync(path, "utf8"))
    expect(state.get("A1")?.status).toBe("failed")
    expect(state.get("A1")?.lastError).toContain("nope")
    rmSync(path, { force: true })
  })

  test("after MAX_ATTEMPTS failures task marked blocked", async () => {
    const path = freshTasksFile()
    seed(path, [t({ id: "A1", verificationCommand: "exit 1", attempts: 5 })])
    const r = await runStophook(["--verify", "A1"], { CODA_TASKS_PATH: path })
    const line = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}")
    expect(line.kind).toBe("blocked")
    const state = Tasks.TasksState.deserialize(readFileSync(path, "utf8"))
    expect(state.get("A1")?.status).toBe("blocked")
    rmSync(path, { force: true })
  })

  test("unknown task id returns error emission", async () => {
    const path = freshTasksFile()
    seed(path, [])
    const r = await runStophook(["--verify", "GHOST"], { CODA_TASKS_PATH: path })
    const line = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}")
    expect(line.kind).toBe("unknown-task")
    rmSync(path, { force: true })
  })

  test("truncates huge stderr in emitted line", async () => {
    const path = freshTasksFile()
    const bigCmd = `bash -c "printf 'x%.0s' {1..5000} 1>&2; exit 1"`
    seed(path, [t({ id: "A1", verificationCommand: bigCmd })])
    const r = await runStophook(["--verify", "A1"], { CODA_TASKS_PATH: path })
    const line = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}")
    expect(line.kind).toBe("failed")
    expect(line.stderr.length).toBeLessThan(5001)
    expect(line.stderr).toContain("truncated")
    rmSync(path, { force: true })
  })
})

describe("stophook --status", () => {
  test("emits summary with counts by status", async () => {
    const path = freshTasksFile()
    seed(path, [
      t({ id: "A1", status: "verified" }),
      t({ id: "A2", status: "pending" }),
      t({ id: "A3", status: "failed" }),
    ])
    const r = await runStophook(["--status"], { CODA_TASKS_PATH: path })
    const line = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}")
    expect(line.kind).toBe("status")
    expect(line.total).toBe(3)
    expect(line.byStatus.verified).toBe(1)
    expect(line.byStatus.pending).toBe(1)
    expect(line.byStatus.failed).toBe(1)
    rmSync(path, { force: true })
  })
})
