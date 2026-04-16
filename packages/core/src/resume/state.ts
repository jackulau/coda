import type { TaskEntry } from "../tasks/state"

export type ResumeAction =
  | { kind: "none" }
  | { kind: "mark-pending"; taskId: string; reason: "clean-working-tree" }
  | { kind: "continue"; taskId: string; reason: "idempotent-retry" }
  | { kind: "rollback"; taskId: string; toSha: string; confirm: boolean }
  | { kind: "abandon"; taskId: string; files: string[] }

export interface ResumeContext {
  workingTreeDirty: boolean
  currentSha: string | null
  taskStartedAtSha?: string
  inReflog: boolean
}

export interface ResumeChoice {
  mode: "rollback" | "continue" | "abandon"
  confirm?: boolean
}

export function planResume(
  task: TaskEntry,
  ctx: ResumeContext,
  choice: ResumeChoice,
): ResumeAction {
  if (task.status !== "in_progress") return { kind: "none" }
  if (!ctx.workingTreeDirty) {
    return { kind: "mark-pending", taskId: task.id, reason: "clean-working-tree" }
  }
  if (choice.mode === "rollback") {
    if (!ctx.taskStartedAtSha) return { kind: "none" }
    if (!ctx.inReflog) return { kind: "none" }
    if (!choice.confirm) return { kind: "none" }
    return {
      kind: "rollback",
      taskId: task.id,
      toSha: ctx.taskStartedAtSha,
      confirm: true,
    }
  }
  if (choice.mode === "continue") {
    return { kind: "continue", taskId: task.id, reason: "idempotent-retry" }
  }
  if (choice.mode === "abandon") {
    return { kind: "abandon", taskId: task.id, files: task.files }
  }
  return { kind: "none" }
}
