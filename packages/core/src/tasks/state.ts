import { z } from "zod"

export const TaskStatus = z.enum(["pending", "in_progress", "verified", "failed", "blocked"])
export type TaskStatus = z.infer<typeof TaskStatus>

export const TaskEntry = z.object({
  id: z.string().min(1),
  phase: z.string().min(1),
  title: z.string(),
  status: TaskStatus.default("pending"),
  dependencies: z.array(z.string()).default([]),
  startedAt: z.number().nullable().default(null),
  startedAtSha: z.string().nullable().default(null),
  completedAt: z.number().nullable().default(null),
  attempts: z.number().int().nonnegative().default(0),
  lastError: z.string().nullable().default(null),
  verificationCommand: z.string(),
  verificationLastPassedAt: z.number().nullable().default(null),
  idempotentHash: z.string().nullable().default(null),
  files: z.array(z.string()).default([]),
})

export type TaskEntry = z.infer<typeof TaskEntry>

export const TasksFile = z.object({
  version: z.literal(1),
  tasks: z.record(TaskEntry),
})

export type TasksFile = z.infer<typeof TasksFile>

export interface ValidationError {
  kind: "cycle" | "dangling-dep" | "schema"
  detail: string
}

export class TasksState {
  private data: TasksFile

  constructor(initial: TasksFile = { version: 1, tasks: {} }) {
    this.data = TasksFile.parse(initial)
  }

  get(id: string): TaskEntry | undefined {
    return this.data.tasks[id]
  }

  list(): TaskEntry[] {
    return Object.values(this.data.tasks)
  }

  listByPhase(phase: string): TaskEntry[] {
    return this.list().filter((t) => t.phase === phase)
  }

  upsert(entry: TaskEntry): void {
    const parsed = TaskEntry.parse(entry)
    this.data.tasks[parsed.id] = parsed
  }

  next(now: number): TaskEntry | null {
    const verified = new Set(
      this.list()
        .filter((t) => t.status === "verified")
        .map((t) => t.id),
    )
    const candidates = this.list().filter(
      (t) => t.status === "pending" && t.dependencies.every((d) => verified.has(d)),
    )
    if (candidates.length === 0) return null
    candidates.sort((a, b) => {
      if (a.phase !== b.phase) return a.phase.localeCompare(b.phase)
      return a.id.localeCompare(b.id)
    })
    return candidates[0] ?? null
  }

  markInProgress(id: string, now: number): void {
    const t = this.required(id)
    this.data.tasks[id] = { ...t, status: "in_progress", startedAt: now, attempts: t.attempts + 1 }
  }

  markVerified(id: string, hash: string, now: number): void {
    const t = this.required(id)
    this.data.tasks[id] = {
      ...t,
      status: "verified",
      completedAt: now,
      verificationLastPassedAt: now,
      idempotentHash: hash,
      lastError: null,
    }
  }

  markFailed(id: string, error: string): void {
    const t = this.required(id)
    this.data.tasks[id] = { ...t, status: "failed", lastError: error }
  }

  markBlocked(id: string, reason: string): void {
    const t = this.required(id)
    this.data.tasks[id] = { ...t, status: "blocked", lastError: reason }
  }

  validate(): ValidationError[] {
    const errors: ValidationError[] = []
    const allIds = new Set(Object.keys(this.data.tasks))
    for (const t of this.list()) {
      for (const d of t.dependencies) {
        if (!allIds.has(d)) {
          errors.push({ kind: "dangling-dep", detail: `${t.id} depends on missing task ${d}` })
        }
      }
    }

    const visiting = new Set<string>()
    const visited = new Set<string>()
    const stack: string[] = []
    const dfs = (node: string): string[] | null => {
      if (visiting.has(node)) {
        const idx = stack.indexOf(node)
        return idx >= 0 ? stack.slice(idx) : [node]
      }
      if (visited.has(node)) return null
      visiting.add(node)
      stack.push(node)
      const t = this.data.tasks[node]
      if (t) {
        for (const dep of t.dependencies) {
          const cycle = dfs(dep)
          if (cycle) return cycle
        }
      }
      stack.pop()
      visiting.delete(node)
      visited.add(node)
      return null
    }
    for (const id of allIds) {
      const cycle = dfs(id)
      if (cycle && cycle.length > 1) {
        errors.push({ kind: "cycle", detail: `dependency cycle: ${cycle.join(" → ")}` })
        break
      }
    }

    return errors
  }

  serialize(): string {
    return JSON.stringify(this.data, null, 2)
  }

  static deserialize(json: string): TasksState {
    const parsed = TasksFile.parse(JSON.parse(json))
    return new TasksState(parsed)
  }

  private required(id: string): TaskEntry {
    const t = this.data.tasks[id]
    if (!t) throw new Error(`unknown task: ${id}`)
    return t
  }
}
