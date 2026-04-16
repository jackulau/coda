import { describe, expect, test } from "bun:test"
import { buildDump, CrashDump, type DumpInput, redactDump } from "../crash/dump"

function input(over: Partial<DumpInput> = {}): DumpInput {
  return {
    origin: "renderer",
    appVersion: "2.0.0",
    platform: "darwin",
    arch: "arm64",
    message: "TypeError: boom",
    stack: "at foo (/path/file.ts:10:5)",
    ...over,
  }
}

describe("crash dump collector (Y3)", () => {
  test("buildDump produces a schema-valid CrashDump", () => {
    const dump = buildDump(input(), 1000)
    const parsed = CrashDump.parse(dump)
    expect(parsed.origin).toBe("renderer")
    expect(parsed.ts).toBe(1000)
    expect(parsed.message).toBe("TypeError: boom")
  })

  test("stack is null when omitted", () => {
    const dump = buildDump(input({ stack: undefined }), 1)
    expect(dump.stack).toBeNull()
  })

  test("redactDump yields a schema-valid redacted dump", () => {
    const dump = buildDump(input({ stack: "at fn (/src/a.ts:5:10)" }), 1)
    const redacted = redactDump(dump)
    // redaction is allowed to replace identifiers; just require schema validity + origin preserved
    expect(redacted.origin).toBe(dump.origin)
    CrashDump.parse(redacted)
  })

  test("valid origin values pass; invalid rejected by schema", () => {
    const dump = buildDump(input(), 1)
    expect(() =>
      CrashDump.parse({ ...dump, origin: "invalid" as unknown as typeof dump.origin }),
    ).toThrow()
  })

  test("sessionId and workspaceId round-trip when provided", () => {
    const dump = buildDump(
      input({
        sessionId: "00000000-0000-0000-0000-000000000301",
        workspaceId: "00000000-0000-0000-0000-000000000302",
      }),
      1,
    )
    expect(dump.sessionId).toBe("00000000-0000-0000-0000-000000000301")
    expect(dump.workspaceId).toBe("00000000-0000-0000-0000-000000000302")
  })
})
