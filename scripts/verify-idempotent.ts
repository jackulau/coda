#!/usr/bin/env bun
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { Tasks } from "../packages/core/src"

const TASKS_PATH = process.env.CODA_TASKS_PATH ?? "tasks/coda-v2-agent-native-ide/TASKS.json"

interface Snapshot {
  gitStatus: string
  treeHashes: Record<string, string>
}

function snapshot(files: string[]): Snapshot {
  const gitStatus = execSync("git status --porcelain", { encoding: "utf8" })
  const treeHashes: Record<string, string> = {}
  for (const f of files) {
    try {
      const data = readFileSync(f)
      treeHashes[f] = Bun.hash(data).toString(16)
    } catch {
      treeHashes[f] = "missing"
    }
  }
  return { gitStatus, treeHashes }
}

function diff(a: Snapshot, b: Snapshot): string[] {
  const diffs: string[] = []
  if (a.gitStatus !== b.gitStatus) {
    diffs.push("git status changed between runs")
  }
  const keys = new Set([...Object.keys(a.treeHashes), ...Object.keys(b.treeHashes)])
  for (const k of keys) {
    if (a.treeHashes[k] !== b.treeHashes[k]) {
      diffs.push(`${k}: ${a.treeHashes[k]} → ${b.treeHashes[k]}`)
    }
  }
  return diffs
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const taskId = args.find((a) => !a.startsWith("--"))
  if (!taskId) {
    console.error("usage: verify-idempotent.ts [--dry-run] <task-id>")
    return 1
  }
  const state = Tasks.TasksState.deserialize(readFileSync(TASKS_PATH, "utf8"))
  const task = state.get(taskId)
  if (!task) {
    console.error(`unknown task: ${taskId}`)
    return 1
  }
  if (dryRun) {
    console.log(
      JSON.stringify({
        kind: "dry-run",
        taskId,
        files: task.files,
        verification: task.verificationCommand,
      }),
    )
    return 0
  }
  const before = snapshot(task.files)
  execSync(task.verificationCommand, { stdio: "inherit" })
  const mid = snapshot(task.files)
  execSync(task.verificationCommand, { stdio: "inherit" })
  const after = snapshot(task.files)
  const diffs = diff(mid, after)
  if (diffs.length > 0) {
    console.error(JSON.stringify({ kind: "NOT-IDEMPOTENT", taskId, diffs }))
    return 1
  }
  console.log(JSON.stringify({ kind: "IDEMPOTENT", taskId, firstRunDiff: diff(before, mid) }))
  return 0
}

if (import.meta.main) {
  main().then((code) => process.exit(code))
}
