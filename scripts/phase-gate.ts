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

export interface GateResult {
  code: 0 | 1 | 3
  phase: string
  totalTasks: number
  pending: { id: string; status: string }[]
}

export function gatePhase(state: Tasks.TasksState, phase: string): GateResult {
  const tasks = state.listByPhase(phase)
  if (tasks.length === 0) {
    return { code: 3, phase, totalTasks: 0, pending: [] }
  }
  const pending = tasks
    .filter((t) => t.status !== "verified")
    .map((t) => ({ id: t.id, status: t.status }))
  return {
    code: pending.length === 0 ? 0 : 1,
    phase,
    totalTasks: tasks.length,
    pending,
  }
}

function gate(state: Tasks.TasksState, phase: string): number {
  const result = gatePhase(state, phase)
  if (result.code === 3) {
    emit({ kind: "unknown-phase", phase })
    return 3
  }
  if (result.code === 1) {
    emit({ kind: "phase-open", phase, pending: result.pending })
    return 1
  }
  emit({ kind: "phase-gate-passed", phase, tasks: result.totalTasks })
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
