export interface ShutdownStage {
  name: string
  priority: number
  dependsOn?: string[]
  run(): Promise<void> | void
}

export interface ShutdownResult {
  order: string[]
  errors: Array<{ stage: string; message: string }>
  durationMs: number
}

export function topologicalOrder(stages: ShutdownStage[]): string[] {
  const byName = new Map(stages.map((s) => [s.name, s]))
  const out: string[] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()

  const visit = (name: string): void => {
    if (visited.has(name)) return
    if (visiting.has(name)) {
      throw new Error(`shutdown cycle involving ${name}`)
    }
    const stage = byName.get(name)
    if (!stage) throw new Error(`unknown shutdown stage: ${name}`)
    visiting.add(name)
    for (const dep of stage.dependsOn ?? []) visit(dep)
    visiting.delete(name)
    visited.add(name)
    out.push(name)
  }

  const sorted = [...stages].sort((a, b) => a.priority - b.priority)
  for (const s of sorted) visit(s.name)
  return out
}

export async function runShutdown(stages: ShutdownStage[]): Promise<ShutdownResult> {
  const start = Date.now()
  const order = topologicalOrder(stages)
  const errors: ShutdownResult["errors"] = []
  const byName = new Map(stages.map((s) => [s.name, s]))

  for (const name of order) {
    const stage = byName.get(name)
    if (!stage) continue
    try {
      await stage.run()
    } catch (err) {
      errors.push({ stage: name, message: err instanceof Error ? err.message : String(err) })
    }
  }

  return { order, errors, durationMs: Date.now() - start }
}
