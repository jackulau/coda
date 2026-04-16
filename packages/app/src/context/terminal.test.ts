import { describe, expect, test } from "bun:test"
import type { PtySession } from "@coda/core/pty"

describe("terminal context types (C2)", () => {
  test("PtySession has the fields the terminal provider persists", () => {
    const sample: Partial<PtySession> = {
      id: "00000000-0000-0000-0000-000000000001",
      workspaceId: "00000000-0000-0000-0000-0000000000a1",
      cwd: "/tmp",
      title: "bash",
      startedAt: 1000,
    }
    expect(sample.id).toBeDefined()
    expect(sample.workspaceId).toBeDefined()
  })
})
