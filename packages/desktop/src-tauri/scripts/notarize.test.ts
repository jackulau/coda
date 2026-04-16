import { describe, expect, test } from "bun:test"

import {
  missingVars,
  NotarizeError,
  type NotarizeEnv,
  notarize,
  parseNotarytoolOutput,
  parseSubmissionId,
} from "./notarize"

interface FakeEnv extends NotarizeEnv {
  files: Set<string>
  runs: Array<{ command: string; args: string[] }>
  responses: Array<{ exitCode: number; stdout: string; stderr: string }>
}

function makeEnv(opts: {
  files?: string[]
  responses?: FakeEnv["responses"]
} = {}): FakeEnv {
  const env: FakeEnv = {
    files: new Set(opts.files ?? []),
    runs: [],
    responses: opts.responses ?? [],
    fileExists(p) {
      return env.files.has(p)
    },
    runCommand(command, args) {
      env.runs.push({ command, args })
      const r = env.responses.shift()
      if (!r) throw new Error(`no response configured for ${command} ${args.join(" ")}`)
      return r
    },
  }
  return env
}

const REQUIRED_VARS = {
  CODA_APPLE_ID: "ci@coda.io",
  CODA_APPLE_TEAM_ID: "TEAM123",
  CODA_APPLE_APP_PASSWORD: "pw",
}

describe("missingVars", () => {
  test("reports nothing when all set", () => {
    expect(missingVars(REQUIRED_VARS)).toEqual([])
  })
  test("reports each unset var", () => {
    expect(missingVars({ CODA_APPLE_ID: "a" })).toEqual([
      "CODA_APPLE_TEAM_ID",
      "CODA_APPLE_APP_PASSWORD",
    ])
  })
})

describe("parseSubmissionId", () => {
  test("finds id in notarytool output", () => {
    expect(parseSubmissionId("id: abcd1234-5678-dead-beef-0000 status: Accepted")).toBe(
      "abcd1234-5678-dead-beef-0000",
    )
  })
  test("returns null if no id", () => {
    expect(parseSubmissionId("nothing here")).toBeNull()
  })
})

describe("parseNotarytoolOutput", () => {
  test("parses JSON output", () => {
    const { id, status } = parseNotarytoolOutput(
      JSON.stringify({ id: "deadbeef-0000", status: "Accepted" }),
    )
    expect(id).toBe("deadbeef-0000")
    expect(status).toBe("Accepted")
  })

  test("handles plain-text Accepted", () => {
    const txt = `id: 1234abcd-5678-dead\nstatus: Accepted\n`
    expect(parseNotarytoolOutput(txt).status).toBe("Accepted")
  })

  test("handles plain-text Invalid", () => {
    expect(parseNotarytoolOutput("status: Invalid").status).toBe("Invalid")
  })

  test("defaults to Unknown on unparsable", () => {
    expect(parseNotarytoolOutput("???").status).toBe("Unknown")
  })
})

describe("notarize — dry run", () => {
  test("reports missing vars and bundle absence without network", () => {
    const env = makeEnv()
    const r = notarize({
      bundlePath: "/dist/app.zip",
      dryRun: true,
      vars: {},
      env,
    })
    expect(r.kind).toBe("dry-run")
    if (r.kind === "dry-run") {
      expect(r.missing).toEqual([
        "CODA_APPLE_ID",
        "CODA_APPLE_TEAM_ID",
        "CODA_APPLE_APP_PASSWORD",
      ])
      expect(r.bundleExists).toBe(false)
    }
    expect(env.runs).toHaveLength(0)
  })

  test("dry-run with valid vars + bundle says ready", () => {
    const env = makeEnv({ files: ["/dist/app.zip"] })
    const r = notarize({
      bundlePath: "/dist/app.zip",
      dryRun: true,
      vars: REQUIRED_VARS,
      env,
    })
    if (r.kind !== "dry-run") throw new Error("not dry-run")
    expect(r.missing).toEqual([])
    expect(r.bundleExists).toBe(true)
  })
})

describe("notarize — submission", () => {
  test("accepts → staples → submitted outcome", () => {
    const env = makeEnv({
      files: ["/dist/app.zip"],
      responses: [
        {
          exitCode: 0,
          stdout: JSON.stringify({ id: "abcd1234-submitid", status: "Accepted" }),
          stderr: "",
        },
        { exitCode: 0, stdout: "Processed staple", stderr: "" },
      ],
    })
    const r = notarize({
      bundlePath: "/dist/app.zip",
      vars: REQUIRED_VARS,
      env,
    })
    if (r.kind !== "submitted") throw new Error("expected submitted, got " + r.kind)
    expect(r.status).toBe("Accepted")
    expect(r.submissionId).toBe("abcd1234-submitid")
    expect(r.stapled).toBe(true)
    expect(env.runs[0].args).toContain("notarytool")
    expect(env.runs[0].args).toContain("submit")
    expect(env.runs[0].args).toContain("--wait")
    expect(env.runs[1].args).toEqual(["stapler", "staple", "/dist/app.zip"])
  })

  test("rejects on Invalid status", () => {
    const env = makeEnv({
      files: ["/dist/app.zip"],
      responses: [
        {
          exitCode: 0,
          stdout: JSON.stringify({ id: "bad-submissionid", status: "Invalid" }),
          stderr: "",
        },
      ],
    })
    const r = notarize({
      bundlePath: "/dist/app.zip",
      vars: REQUIRED_VARS,
      env,
    })
    if (r.kind !== "rejected") throw new Error(`expected rejected, got ${r.kind}`)
    expect(r.submissionId).toBe("bad-submissionid")
    expect(r.reason).toMatch(/Invalid/)
    // stapler must not have been called
    expect(env.runs).toHaveLength(1)
  })

  test("rejects when notarytool exits non-zero", () => {
    const env = makeEnv({
      files: ["/dist/app.zip"],
      responses: [{ exitCode: 1, stdout: "", stderr: "network error" }],
    })
    const r = notarize({
      bundlePath: "/dist/app.zip",
      vars: REQUIRED_VARS,
      env,
    })
    if (r.kind !== "rejected") throw new Error("expected rejected")
    expect(r.reason).toMatch(/network error/)
  })

  test("throws missing-env when vars incomplete and not dry-run", () => {
    const env = makeEnv({ files: ["/dist/app.zip"] })
    expect(() =>
      notarize({
        bundlePath: "/dist/app.zip",
        vars: { CODA_APPLE_ID: "a" },
        env,
      }),
    ).toThrow(NotarizeError)
  })

  test("throws missing-bundle when file does not exist", () => {
    const env = makeEnv()
    expect(() =>
      notarize({
        bundlePath: "/dist/nonesuch.zip",
        vars: REQUIRED_VARS,
        env,
      }),
    ).toThrow(/bundle not found/)
  })

  test("staple failure throws NotarizeError staple-failed", () => {
    const env = makeEnv({
      files: ["/dist/app.zip"],
      responses: [
        {
          exitCode: 0,
          stdout: JSON.stringify({ id: "ok-submissionid", status: "Accepted" }),
          stderr: "",
        },
        { exitCode: 65, stdout: "", stderr: "stapler: couldn't find ticket" },
      ],
    })
    expect(() =>
      notarize({
        bundlePath: "/dist/app.zip",
        vars: REQUIRED_VARS,
        env,
      }),
    ).toThrow(/stapler staple failed/)
  })

  test("passes Apple credentials through to xcrun args", () => {
    const env = makeEnv({
      files: ["/dist/app.zip"],
      responses: [
        {
          exitCode: 0,
          stdout: JSON.stringify({ id: "xyz-cred-check", status: "Accepted" }),
          stderr: "",
        },
        { exitCode: 0, stdout: "", stderr: "" },
      ],
    })
    notarize({
      bundlePath: "/dist/app.zip",
      vars: REQUIRED_VARS,
      env,
    })
    const args = env.runs[0].args
    const i = args.indexOf("--apple-id")
    expect(args[i + 1]).toBe(REQUIRED_VARS.CODA_APPLE_ID)
    const j = args.indexOf("--team-id")
    expect(args[j + 1]).toBe(REQUIRED_VARS.CODA_APPLE_TEAM_ID)
    const k = args.indexOf("--password")
    expect(args[k + 1]).toBe(REQUIRED_VARS.CODA_APPLE_APP_PASSWORD)
  })
})
