#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { Tasks } from "../packages/core/src"

const TASKS_PATH = process.env.CODA_TASKS_PATH ?? "tasks/coda-v2-agent-native-ide/TASKS.json"
const STOP_FILE = process.env.CODA_STOP_FILE ?? `${process.env.HOME}/.coda/stophook.stop`
const MAX_ATTEMPTS = Number.parseInt(process.env.CODA_MAX_ATTEMPTS ?? "5", 10)

type Mode = "plan" | "verify" | "status" | "seed"

interface ParsedArgs {
  mode: Mode
  taskId?: string
  command?: string
  tasksPath: string
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2)
  const out: ParsedArgs = { mode: "plan", tasksPath: TASKS_PATH }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--plan") {
      out.mode = "plan"
      const next = args[i + 1]
      if (next && !next.startsWith("--")) {
        out.taskId = next
        i++
      }
    } else if (a === "--verify") {
      out.mode = "verify"
      const next = args[i + 1]
      if (next && !next.startsWith("--")) {
        out.taskId = next
        i++
      }
    } else if (a === "--status") {
      out.mode = "status"
    } else if (a === "--seed") {
      out.mode = "seed"
    } else if (a === "--tasks") {
      const next = args[i + 1]
      if (next) {
        out.tasksPath = next
        i++
      }
    }
  }
  return out
}

function stopFilePresent(): boolean {
  try {
    return existsSync(STOP_FILE)
  } catch {
    return false
  }
}

function loadState(path: string): Tasks.TasksState {
  if (!existsSync(path)) {
    const seeded = new Tasks.TasksState()
    writeAtomic(path, seeded.serialize())
    return seeded
  }
  const json = readFileSync(path, "utf8")
  return Tasks.TasksState.deserialize(json)
}

function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, content)
  renameSync(tmp, path)
}

function saveState(state: Tasks.TasksState, path: string): void {
  writeAtomic(path, state.serialize())
}

function emit(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: Date.now(), ...event }))
}

function cmdStatus(state: Tasks.TasksState): void {
  const byStatus = new Map<string, number>()
  for (const t of state.list()) {
    byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1)
  }
  emit({ kind: "status", byStatus: Object.fromEntries(byStatus), total: state.list().length })
}

function cmdPlan(state: Tasks.TasksState, path: string, explicit?: string): number {
  if (stopFilePresent()) {
    emit({ kind: "halt", reason: "stop-file-present", path: STOP_FILE })
    return 0
  }
  const errors = state.validate()
  if (errors.length > 0) {
    emit({ kind: "validation-error", errors })
    return 1
  }
  const task = explicit ? state.get(explicit) : state.next(Date.now())
  if (!task) {
    emit({ kind: "no-work" })
    return 0
  }
  if (task.status === "blocked") {
    emit({ kind: "blocked", taskId: task.id, reason: task.lastError ?? "blocked" })
    return 0
  }
  state.markInProgress(task.id, Date.now())
  saveState(state, path)
  emit({
    kind: "plan",
    taskId: task.id,
    phase: task.phase,
    title: task.title,
    files: task.files,
    verification: task.verificationCommand,
    attempt: task.attempts,
  })
  return 0
}

function hashInputs(task: Tasks.TaskEntry): string {
  const data = [task.id, task.verificationCommand, ...task.files.sort()].join("\n")
  return Bun.hash(data).toString(16)
}

async function cmdVerify(state: Tasks.TasksState, path: string, taskId: string): Promise<number> {
  const task = state.get(taskId)
  if (!task) {
    emit({ kind: "unknown-task", taskId })
    return 1
  }
  const proc = Bun.spawn(["bash", "-c", task.verificationCommand], {
    stderr: "pipe",
    stdout: "pipe",
  })
  const exit = await proc.exited
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  if (exit === 0) {
    state.markVerified(taskId, hashInputs(task), Date.now())
    saveState(state, path)
    emit({ kind: "verified", taskId, stdout: truncate(stdout), stderr: truncate(stderr) })
    return 0
  }
  if (task.attempts >= MAX_ATTEMPTS) {
    state.markBlocked(taskId, `exceeded ${MAX_ATTEMPTS} attempts: ${truncate(stderr)}`)
    saveState(state, path)
    emit({ kind: "blocked", taskId, attempts: task.attempts })
    return 0
  }
  state.markFailed(taskId, truncate(stderr))
  saveState(state, path)
  emit({
    kind: "failed",
    taskId,
    exit,
    attempts: task.attempts,
    stdout: truncate(stdout),
    stderr: truncate(stderr),
  })
  return 0
}

function truncate(s: string, max = 4000): string {
  return s.length <= max ? s : `${s.slice(0, max)}... [${s.length - max} bytes truncated]`
}

async function cmdSeed(path: string): Promise<number> {
  const state = new Tasks.TasksState()
  for (const t of seedEntries()) state.upsert(t)
  const errors = state.validate()
  if (errors.length > 0) {
    emit({ kind: "seed-validation-failed", errors })
    return 1
  }
  saveState(state, path)
  emit({ kind: "seeded", count: state.list().length, path })
  return 0
}

function seedEntries(): Tasks.TaskEntry[] {
  const mk = (
    id: string,
    phase: string,
    title: string,
    verification: string,
    deps: string[] = [],
  ): Tasks.TaskEntry => ({
    id,
    phase,
    title,
    status: "pending",
    dependencies: deps,
    startedAt: null,
    completedAt: null,
    attempts: 0,
    lastError: null,
    verificationCommand: verification,
    verificationLastPassedAt: null,
    idempotentHash: null,
    files: [],
  })
  const core = "bun test packages/core/src"
  return [
    mk(
      "A1",
      "A",
      "Workspace+Project stores + event bus",
      `${core}/workspace ${core}/project ${core}/event`,
    ),
    mk("A2", "A", "PtySession CRUD + cascade", `${core}/pty`, ["A1"]),
    mk("A3", "A", "GitHub PR client + auth + errors", `${core}/github`, ["A1"]),
    mk("A4", "A", "HMAC RPC middleware + timeout", `${core}/protocol`, ["A1"]),
    mk("B1", "B", "Sidebar grouping helpers", `${core}/workspace/sidebar-helpers.test.ts`, ["A1"]),
    mk("B2", "B", "Drag-reorder + pin", `${core}/workspace/reorder.test.ts`, ["B1"]),
    mk("E1", "E", "Unified diff parser", `${core}/diff`, ["A3"]),
    mk("F", "F", "Browser partition + nav guard", `${core}/browser`, ["A4"]),
    mk("H1", "H", "Port parsers + attribution", `${core}/port`, ["A1"]),
    mk("J1", "J", "Watchdog circuit", `${core}/watchdog`, ["A4"]),
    mk("J2", "J", "Layout snapshot v1→v2", `${core}/storage`, ["A1"]),
    mk("J3", "J", "Perf budgets + p95/p99", `${core}/perf/budget.test.ts`, ["J1"]),
    mk("J4", "J", "Resource quotas ladder", `${core}/perf/quotas.test.ts`, ["J1"]),
    mk("J7", "J", "Lock graph + deadlock detection", `${core}/locks`, ["A1"]),
    mk("U2", "U", "Command palette fuzzy scorer", `${core}/palette`, ["A1"]),
    mk("U3", "U", "Shortcut registry", `${core}/shortcuts`, ["A1"]),
    mk("X2", "X", "Update channel selector", `${core}/update`, []),
    mk(
      "Y1",
      "Y",
      "Log writer + redaction",
      `${core}/log/writer.test.ts ${core}/log/redact.test.ts`,
      [],
    ),
    mk("Y2", "Y", "Log viewer query + filter", `${core}/log/viewer.test.ts`, ["Y1"]),
    mk("Y4", "Y", "Feature flags + kill switch", `${core}/flags`, []),
    mk("0.1", "0", "TASKS.json state machine", `${core}/tasks`, []),
    mk("D7", "D", "Find + replace across files", `${core}/search`, []),
    mk("I2", "I", "Problems panel aggregation", `${core}/problems`, []),
    mk("I3", "I", "Git status porcelain parser", `${core}/git`, []),
    mk("J8", "J", "Graceful shutdown topology", `${core}/lifecycle`, ["A1"]),
    mk("V3", "V", "Reduced-motion policy", `${core}/a11y`, []),
    mk("U1", "U", "Menu bar model + disabled evaluator", `${core}/menu`, []),
    mk("U4", "U", "Notification queue (dedup + capacity)", `${core}/notify`, []),
    mk("E2", "E", "Compare two PRs delta", `${core}/github/compare.test.ts`, ["E1"]),
    mk("P1", "P", "Onboarding wizard state machine", `${core}/onboarding`, []),
    mk("P2", "P", "Settings persistence + v1→v2 migration", `${core}/settings`, []),
    mk("V1", "V", "Visual signature store", `${core}/visual`, []),
    mk("Y3", "Y", "Crash dump schema + index", `${core}/crash`, ["Y1"]),
    mk("T11", "T", "Checkpoint git private refs", `${core}/checkpoint`, []),
    mk("T16", "T", "MCP tool dispatch", `${core}/mcp`, []),
    mk("T19", "T", "Virtual scroll window calc", `${core}/virtual`, []),
    mk("C1", "C", "PTY lifecycle manager + MockPtyDriver", `${core}/pty-lifecycle`, ["A2"]),
    mk("C3", "C", "Agent resume command builder", `${core}/agent`, []),
    mk("D1", "D", "File tree flatten + filter", `${core}/file-tree`, ["T19"]),
    mk("D2", "D", "Editor buffer + edit semantics", `${core}/editor/buffer.test.ts`, []),
    mk("D3", "D", "Jump-to-diff-hunk", `${core}/editor/jump.test.ts`, ["E1"]),
    mk("D4", "D", "Editor theme catalog", `${core}/editor/themes.test.ts`, []),
    mk("D6", "D", "Editor feature toggles", `${core}/editor/features.test.ts`, []),
    mk("D8", "D", "Save-file MCP tool", `${core}/mcp/save-file.test.ts`, ["T16"]),
    mk("X1", "X", "Code-signing audit", `${core}/signing`, []),
    mk("0.5", "0", "Resume state machine", `${core}/resume`, ["0.1"]),
    mk("J5", "J", "Watchdog-of-watchdog supervisor", `${core}/watchdog/supervisor.test.ts`, ["J1"]),
    mk("V2", "V", "Axe violation grouping + gate", `${core}/a11y/axe.test.ts`, []),
    mk(
      "P3",
      "P",
      "Project actions (rename/remove/reveal/clone)",
      `${core}/project/actions.test.ts`,
      ["A1"],
    ),
    mk("C2", "C", "PTY reattach across sidecar restart", `${core}/pty-reattach`, ["A2"]),
    mk("C4", "C", "Terminal tabs mounted across worktree switch", `${core}/terminal-switch`, [
      "C1",
    ]),
    mk("C5", "C", "Terminal settings live-apply + defaults", `${core}/terminal-settings`, ["C1"]),
    mk("J6", "J", "Timeout budgets + withTimeout helper", `${core}/util/timeout`, []),
    mk("T1", "T", "Foundation biome/package.json audit", `${core}/foundation`, []),
    mk("T2", "T", "Browser panel history + nav stack", `${core}/browser-panel`, []),
    mk(
      "T3",
      "T",
      "Inspector picker/overlay/css-baseline",
      `${core}/inspector/inspector.test.ts`,
      [],
    ),
    mk("T4", "T", "ARIA snapshot + selector scorer", `${core}/inspector/aria-snapshot.test.ts`, []),
    mk(
      "T5",
      "T",
      "Framework adapters (angular/lit/generic)",
      `${core}/inspector/frameworks.test.ts`,
      [],
    ),
    mk(
      "T6",
      "T",
      "Inspector → Agent message formatter",
      `${core}/inspector/send-to-agent.test.ts`,
      [],
    ),
    mk(
      "T7n",
      "T",
      "Network request interception + classify",
      `${core}/inspector/network.test.ts`,
      [],
    ),
    mk(
      "T7p",
      "T",
      "Performance metrics (FCP/LCP/CLS/INP/LoAF)",
      `${core}/inspector/performance.test.ts`,
      [],
    ),
    mk("T8", "T", "Accessibility audit formatter", `${core}/inspector/accessibility.test.ts`, []),
    mk("T9", "T", "Diff viewer chunk logic (accept/reject/collapse)", `${core}/diff-ops`, []),
    mk("T10", "T", "AI diff-comments CRUD + resolve", `${core}/diff-comments`, []),
    mk("T12", "T", "Checkpoint timeline model + search", `${core}/checkpoint-timeline`, ["T11"]),
    mk("T14", "T", "Agent dashboard state + sort", `${core}/agent-dashboard`, []),
    mk("T15", "T", "Agent wrapper spawn + env sanitize", `${core}/agent-wrapper`, []),
    mk("T17", "T", "LSP features (semantic tokens/rename/pending)", `${core}/lsp`, []),
    mk("T21c", "T", "Cloud agent execution scheduler", `${core}/cloud`, []),
    mk("T21r", "T", "Remote SSH target + session", `${core}/remote`, []),
    mk("T23", "T", "Settings UI catalog + validator", `${core}/settings-ui`, []),
    mk("T24", "T", "Status bar model + problems summary", `${core}/status-bar`, []),
  ]
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv)
  const path = resolve(process.cwd(), args.tasksPath)

  if (args.mode === "seed") return cmdSeed(path)

  const state = loadState(path)
  if (args.mode === "status") {
    cmdStatus(state)
    return 0
  }
  if (args.mode === "plan") return cmdPlan(state, path, args.taskId)
  if (args.mode === "verify") {
    if (!args.taskId) {
      emit({ kind: "error", reason: "--verify requires a task id" })
      return 1
    }
    return cmdVerify(state, path, args.taskId)
  }
  emit({ kind: "error", reason: "unknown mode" })
  return 1
}

if (import.meta.main) {
  main().then((code) => {
    process.exit(code)
  })
}
