import { scrubSecretEnv } from "../pty"
import { PtySessionStore } from "../pty/session-store"
import { WorkspaceStore } from "../workspace/store"
import type { PtyDriver, PtyDriverSpawnOpts } from "./driver"

export interface SpawnForWorkspaceArgs {
  workspaceId: string
  title: string
  cmd: string
  args?: string[]
  env?: Record<string, string>
}

export interface SpawnResult {
  sessionId: string
  driverId: string
}

export type SpawnError =
  | { code: "ENOENT"; message: string }
  | { code: "EACCES"; message: string }
  | { code: "ENOTDIR"; message: string }
  | { code: "NO_WORKSPACE"; message: string }
  | { code: "UNKNOWN"; message: string }

export interface CwdProbe {
  access(cwd: string): Promise<"ok" | "ENOENT" | "EACCES" | "ENOTDIR">
}

export class PtyLifecycleManager {
  constructor(
    private readonly driver: PtyDriver,
    private readonly probe: CwdProbe,
  ) {}

  async spawn(args: SpawnForWorkspaceArgs): Promise<SpawnResult | SpawnError> {
    const workspace = WorkspaceStore.get(args.workspaceId)
    if (!workspace) {
      return { code: "NO_WORKSPACE", message: `no workspace ${args.workspaceId}` }
    }
    const access = await this.probe.access(workspace.cwd)
    if (access !== "ok") {
      return { code: access, message: `cwd ${workspace.cwd} ${access}` }
    }
    const cleanedEnv = scrubSecretEnv({ ...process.env, ...(args.env ?? {}) })
    const session = PtySessionStore.create({
      workspaceId: workspace.id,
      cwd: workspace.cwd,
      title: args.title,
    })
    const spawnOpts: PtyDriverSpawnOpts = {
      id: session.id,
      cwd: workspace.cwd,
      cmd: args.cmd,
      ...(args.args !== undefined && { args: args.args }),
      env: cleanedEnv,
    }
    try {
      await this.driver.spawn(spawnOpts)
    } catch (err) {
      PtySessionStore.markExited(session.id, -1)
      return { code: "UNKNOWN", message: err instanceof Error ? err.message : String(err) }
    }
    this.driver.onExit(session.id, (code) => {
      PtySessionStore.markExited(session.id, code)
    })
    return { sessionId: session.id, driverId: session.id }
  }

  async terminate(sessionId: string, graceMs = 5000): Promise<number | null> {
    const termPromise = this.driver.kill(sessionId, "SIGTERM")
    const timer = new Promise<null>((resolve) =>
      setTimeout(() => {
        resolve(null)
      }, graceMs),
    )
    const winner = await Promise.race([termPromise, timer])
    if (winner !== null) return winner
    return this.driver.kill(sessionId, "SIGKILL")
  }
}

export class NoopCwdProbe implements CwdProbe {
  access(): Promise<"ok"> {
    return Promise.resolve("ok")
  }
}

export class ScriptedCwdProbe implements CwdProbe {
  constructor(private readonly behavior: "ok" | "ENOENT" | "EACCES" | "ENOTDIR") {}
  access(): Promise<typeof this.behavior> {
    return Promise.resolve(this.behavior)
  }
}
