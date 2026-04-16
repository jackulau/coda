#!/usr/bin/env bun
import { readFileSync } from "node:fs"
import { Tasks } from "../packages/core/src"

const TASKS_PATH = process.env.CODA_TASKS_PATH ?? "tasks/coda-v2-agent-native-ide/TASKS.json"

function loadState(path: string): Tasks.TasksState {
  const json = readFileSync(path, "utf8")
  return Tasks.TasksState.deserialize(json)
}

function emit(obj: Record<string, unknown>): void {
  console.log(JSON.stringify(obj))
}

function gate(state: Tasks.TasksState, phase: string): number {
  const tasks = state.listByPhase(phase)
  if (tasks.length === 0) {
    emit({ kind: "unknown-phase", phase })
    return 3
  }
  const notVerified = tasks.filter((t) => t.status !== "verified")
  if (notVerified.length > 0) {
    emit({
      kind: "phase-open",
      phase,
      pending: notVerified.map((t) => ({ id: t.id, status: t.status })),
    })
    return 1
  }
  emit({ kind: "phase-gate-passed", phase, tasks: tasks.length })
  return 0
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const all = args.includes("--all")
  const path = TASKS_PATH
  const state = loadState(path)

  if (all) {
    const phases = new Set(state.list().map((t) => t.phase))
    let exitCode = 0
    for (const p of [...phases].sort()) {
      const rc = gate(state, p)
      if (rc !== 0) exitCode = rc
    }
    return exitCode
  }

  const phase = args.find((a) => !a.startsWith("--"))
  if (!phase) {
    emit({ kind: "error", reason: "phase name or --all required" })
    return 1
  }
  return gate(state, phase)
}

if (import.meta.main) {
  main().then((code) => process.exit(code))
}
