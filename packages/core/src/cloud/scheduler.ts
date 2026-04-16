export type CloudJobStatus =
  | "queued"
  | "provisioning"
  | "running"
  | "finished"
  | "failed"
  | "cancelled"

export interface CloudJob {
  id: string
  workspaceId: string
  command: string
  priority: number
  status: CloudJobStatus
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  region: string
  cost: number
}

export interface SchedulerLimits {
  maxConcurrent: number
  maxPerWorkspace: number
}

export function nextRunnable(
  jobs: CloudJob[],
  limits: SchedulerLimits,
  now: number,
): CloudJob | null {
  void now
  const running = jobs.filter((j) => j.status === "running" || j.status === "provisioning")
  if (running.length >= limits.maxConcurrent) return null
  const perWorkspace = new Map<string, number>()
  for (const r of running) {
    perWorkspace.set(r.workspaceId, (perWorkspace.get(r.workspaceId) ?? 0) + 1)
  }
  const queued = jobs
    .filter((j) => j.status === "queued")
    .filter((j) => (perWorkspace.get(j.workspaceId) ?? 0) < limits.maxPerWorkspace)
    .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)
  return queued[0] ?? null
}

export function transitionJob(
  job: CloudJob,
  event:
    | { kind: "provision"; at: number }
    | { kind: "start"; at: number }
    | { kind: "finish"; at: number; cost: number }
    | { kind: "fail"; at: number; reason: string }
    | { kind: "cancel"; at: number },
): CloudJob {
  switch (event.kind) {
    case "provision":
      if (job.status !== "queued") throw new Error("provision from non-queued")
      return { ...job, status: "provisioning" }
    case "start":
      if (job.status !== "provisioning") throw new Error("start from non-provisioning")
      return { ...job, status: "running", startedAt: event.at }
    case "finish":
      if (job.status !== "running") throw new Error("finish from non-running")
      return {
        ...job,
        status: "finished",
        finishedAt: event.at,
        cost: event.cost,
      }
    case "fail":
      return { ...job, status: "failed", finishedAt: event.at }
    case "cancel":
      return { ...job, status: "cancelled", finishedAt: event.at }
  }
}

export function pickRegion(availability: Record<string, { rttMs: number; load: number }>): string {
  const entries = Object.entries(availability)
  if (entries.length === 0) return ""
  entries.sort((a, b) => a[1].rttMs + a[1].load * 100 - (b[1].rttMs + b[1].load * 100))
  return entries[0]?.[0] ?? ""
}
