import { describe, expect, test } from "bun:test"
import {
  RemoteSession,
  RemoteTarget,
  buildSshArgs,
  forwardArgs,
  redactIdentityFile,
} from "./session"

describe("RemoteTarget schema", () => {
  test("defaults port to 22", () => {
    const t = RemoteTarget.parse({
      id: "x",
      label: "Box",
      host: "example.com",
      user: "dev",
      authKind: "agent",
    })
    expect(t.port).toBe(22)
  })

  test("rejects invalid port", () => {
    expect(() =>
      RemoteTarget.parse({
        id: "x",
        label: "Box",
        host: "h",
        user: "u",
        port: 0,
        authKind: "agent",
      }),
    ).toThrow()
  })
})

describe("RemoteSession schema", () => {
  test("accepts valid session", () => {
    expect(
      RemoteSession.parse({
        id: "s",
        targetId: "t",
        workspaceId: "w",
        startedAt: 1,
        endedAt: null,
        status: "connected",
      }).status,
    ).toBe("connected")
  })
})

describe("buildSshArgs", () => {
  test("minimal agent auth", () => {
    const args = buildSshArgs({
      id: "x",
      label: "Box",
      host: "example.com",
      user: "dev",
      port: 22,
      authKind: "agent",
    })
    expect(args).toEqual(["dev@example.com"])
  })

  test("key auth with identity file", () => {
    const args = buildSshArgs({
      id: "x",
      label: "Box",
      host: "h",
      user: "u",
      port: 22,
      authKind: "key",
      identityFile: "/keys/id_ed25519",
    })
    expect(args).toEqual(["-i", "/keys/id_ed25519", "u@h"])
  })

  test("custom port + jump host", () => {
    const args = buildSshArgs({
      id: "x",
      label: "Box",
      host: "h",
      user: "u",
      port: 2222,
      authKind: "agent",
      jumpHost: "bastion",
    })
    expect(args).toEqual(["-J", "bastion", "-p", "2222", "u@h"])
  })
})

describe("forwardArgs + redactIdentityFile", () => {
  test("forwards flatten to -L args", () => {
    expect(
      forwardArgs([
        { localPort: 5432, remoteHost: "localhost", remotePort: 5432 },
        { localPort: 6379, remoteHost: "db", remotePort: 6379 },
      ]),
    ).toEqual(["-L", "5432:localhost:5432", "-L", "6379:db:6379"])
  })

  test("redactIdentityFile replaces -i argument", () => {
    expect(redactIdentityFile(["-i", "/keys/x", "u@h"])).toEqual(["-i", "<REDACTED>", "u@h"])
  })
})
