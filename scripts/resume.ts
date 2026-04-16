#!/usr/bin/env bun
import { execSync } from "node:child_process"
import { Resume, type Tasks } from "../packages/core/src"
import { Store } from "./tasks-state"

export interface GitSnapshot {
  currentSha: string | null
  workingTreeDirty: boolean
  inReflog(sha: string): boolean
}

export function readGitSnapshot(cwd = process.cwd()): GitSnapshot {
  const run = (cmd: string) =>
    execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
  let currentSha: string | null = null
  try {
    currentSha = run("git rev-parse HEAD")
  } catch {
    currentSha = null
  }
  let dirty = false
  try {
    dirty = run("git status --porcelain").length > 0
  } catch {
    dirty = false
  }
  return {
    currentSha,
    workingTreeDirty: dirty,
    inReflog: (sha: string) => {
      try {
        run(`git cat-file -e ${sha}`)
        return true
      } catch {
        return false
      }
    },
  }
}

export interface RunOpts {
  storePath?: string
  git?: GitSnapshot
  mode: "rollback" | "continue" | "abandon"
  confirm?: boolean
  pickFirst?: boolean
  taskId?: string
}

export function selectInProgress(
  state: Tasks.TasksState,
  pickFirst: boolean,
  explicitId?: string,
): Tasks.TaskEntry | null {
  if (explicitId) return state.get(explicitId) ?? null
  const inProgress = state.list().filter((t) => t.status === "in_progress")
  if (inProgress.length === 0) return null
  if (inProgress.length === 1 || pickFirst) {
    return inProgress.sort((a, b) => a.id.localeCompare(b.id))[0] ?? null
  }
  return null
}

export function plan(opts: RunOpts, state: Tasks.TasksState): Resume.ResumeAction {
  const task = selectInProgress(state, opts.pickFirst ?? false, opts.taskId)
  if (!task) return { kind: "none" }
  const git = opts.git ?? readGitSnapshot()
  const startedAtSha = task.startedAtSha ?? undefined
  return Resume.planResume(
    task,
    {
      workingTreeDirty: git.workingTreeDirty,
      currentSha: git.currentSha,
      taskStartedAtSha: startedAtSha,
      inReflog: startedAtSha ? git.inReflog(startedAtSha) : false,
    },
    { mode: opts.mode, confirm: opts.confirm },
  )
}

export async function cli(args: string[]): Promise<number> {
  const opts: RunOpts = { mode: "continue" }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--rollback") opts.mode = "rollback"
    else if (a === "--continue") opts.mode = "continue"
    else if (a === "--abandon") opts.mode = "abandon"
    else if (a === "--confirm") opts.confirm = true
    else if (a === "--pick-first") opts.pickFirst = true
    else if (a && !a.startsWith("--")) opts.taskId = a
  }
  const store = new Store({ path: opts.storePath })
  const state = store.load()
  const action = plan(opts, state)
  if (action.kind === "none") {
    console.log(JSON.stringify({ kind: "none", reason: "nothing-to-do" }))
    return 0
  }
  if (opts.mode === "rollback" && !opts.confirm) {
    console.error("refusing to rollback without --confirm")
    return 2
  }
  console.log(JSON.stringify(action))
  return 0
}

if (import.meta.main) {
  cli(process.argv.slice(2)).then((code) => process.exit(code))
}
