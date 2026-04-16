#!/usr/bin/env bun
import { createHash } from "node:crypto"
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { Tasks } from "../packages/core/src"

const DEFAULT_PATH = join(process.cwd(), "tasks/coda-v2-agent-native-ide/TASKS.json")

export interface StoreOptions {
  path?: string
}

export class Store {
  private path: string

  constructor(opts: StoreOptions = {}) {
    this.path = opts.path ?? process.env.CODA_TASKS_PATH ?? DEFAULT_PATH
  }

  load(): Tasks.TasksState {
    try {
      const raw = readFileSync(this.path, "utf8")
      return Tasks.TasksState.deserialize(raw)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        const s = new Tasks.TasksState()
        this.save(s)
        return s
      }
      throw err
    }
  }

  save(state: Tasks.TasksState): void {
    const data = state.serialize()
    const lock = `${this.path}.lock`
    try {
      const fd = openSync(lock, "wx")
      closeSync(fd)
    } catch {
      throw new Error(`tasks-state: lock file exists at ${lock}; another writer is active`)
    }
    try {
      const bak = `${this.path}.bak`
      try {
        const existing = readFileSync(this.path, "utf8")
        writeFileSync(bak, existing)
      } catch {
        // no previous file; no backup needed
      }
      const tmp = `${this.path}.tmp`
      writeFileSync(tmp, data)
      renameSync(tmp, this.path)
    } finally {
      try {
        rmSync(lock, { force: true })
      } catch {}
    }
  }
}

export function idempotentHash(taskId: string, inputFiles: string[], verification: string): string {
  const h = createHash("sha256")
  h.update(taskId)
  h.update("\0")
  for (const f of inputFiles.sort()) {
    h.update(f)
    h.update("\0")
    try {
      h.update(readFileSync(f))
    } catch {
      h.update("MISSING")
    }
    h.update("\0")
  }
  h.update(verification)
  return h.digest("hex").slice(0, 16)
}

export async function cli(args: string[]): Promise<number> {
  const [cmd, ...rest] = args
  const store = new Store()
  const state = store.load()
  const now = Date.now()
  switch (cmd) {
    case "get": {
      const id = rest[0]
      if (!id) {
        console.error("usage: get <id>")
        return 2
      }
      const t = state.get(id)
      if (!t) {
        console.error("not found")
        return 1
      }
      console.log(JSON.stringify(t, null, 2))
      return 0
    }
    case "next": {
      const t = state.next(now)
      if (!t) {
        console.log("")
        return 0
      }
      console.log(JSON.stringify(t, null, 2))
      return 0
    }
    case "list": {
      const phase = rest[0]
      const entries = phase ? state.listByPhase(phase) : state.list()
      console.log(JSON.stringify(entries, null, 2))
      return 0
    }
    case "validate": {
      const errs = state.validate()
      if (errs.length === 0) {
        console.log("ok")
        return 0
      }
      for (const e of errs) console.error(`${e.kind}: ${e.detail}`)
      return 1
    }
    case "mark-in-progress": {
      const id = rest[0]
      if (!id) return 2
      state.markInProgress(id, now)
      store.save(state)
      return 0
    }
    case "mark-verified": {
      const id = rest[0]
      const hash = rest[1] ?? ""
      if (!id) return 2
      state.markVerified(id, hash, now)
      store.save(state)
      return 0
    }
    case "mark-failed": {
      const id = rest[0]
      const err = rest.slice(1).join(" ")
      if (!id) return 2
      state.markFailed(id, err)
      store.save(state)
      return 0
    }
    default:
      console.error(
        "usage: tasks-state <get|next|list|validate|mark-in-progress|mark-verified|mark-failed>",
      )
      return 2
  }
}

if (import.meta.main) {
  cli(process.argv.slice(2)).then((code) => process.exit(code))
}
