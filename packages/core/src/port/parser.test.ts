import { describe, expect, test } from "bun:test"
import { attribute, parseLsofOutput, parseNetstatOutput, parseSsOutput } from "./parser"

describe("parseLsofOutput (macOS)", () => {
  test("parses listening TCP entries", () => {
    const stdout = `COMMAND     PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      45821  jack   23u  IPv4 0xabcdef1234567890      0t0  TCP 127.0.0.1:3000 (LISTEN)
node      45821  jack   24u  IPv4 0xabcdef1234567891      0t0  TCP *:5173 (LISTEN)
ssh        9923  jack   12u  IPv6 0xabcdef1234567892      0t0  TCP [::1]:22022 (LISTEN)
`
    const out = parseLsofOutput(stdout)
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({ port: 3000, pid: 45821, command: "node", bindAddress: "127.0.0.1" })
    expect(out[2]?.port).toBe(22022)
    expect(out[2]?.bindAddress).toBe("[::1]")
  })

  test("ignores non-IP rows", () => {
    expect(parseLsofOutput("COMMAND PID USER FD TYPE\nnode 1 j 1u BAD x")).toHaveLength(0)
  })

  test("ignores invalid port numbers", () => {
    const stdout = `COMMAND PID USER FD TYPE D S N NAME
node 1 j 1u IPv4 1 1 1 127.0.0.1:9999999 (LISTEN)`
    expect(parseLsofOutput(stdout)).toHaveLength(0)
  })
})

describe("parseSsOutput (Linux)", () => {
  test("parses ss -tlnp output", () => {
    const stdout = `State    Recv-Q Send-Q Local Address:Port Peer Address:Port Process
LISTEN   0      511    127.0.0.1:3000     0.0.0.0:*         users:(("node",pid=12345,fd=23))
LISTEN   0      511    [::]:8080          [::]:*            users:(("vite",pid=7777,fd=12))
`
    const out = parseSsOutput(stdout)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({
      port: 3000,
      pid: 12345,
      command: "node",
      bindAddress: "127.0.0.1",
    })
    expect(out[1]?.port).toBe(8080)
  })
})

describe("parseNetstatOutput (Windows)", () => {
  test("parses netstat -ano TCP listeners", () => {
    const stdout = `Active Connections
  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       4421
  TCP    [::]:8080              [::]:0                 LISTENING       9988
  TCP    127.0.0.1:6789         0.0.0.0:0              LISTENING       1
`
    const out = parseNetstatOutput(stdout)
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({
      port: 3000,
      pid: 4421,
      command: "?",
      bindAddress: "0.0.0.0",
    })
  })
})

describe("attribute", () => {
  test("attributes Coda-spawned PIDs to workspace, others marked external", () => {
    const parsed = [
      { port: 3000, pid: 100, command: "node", bindAddress: "127.0.0.1" },
      { port: 5173, pid: 200, command: "vite", bindAddress: "127.0.0.1" },
      { port: 8080, pid: 999, command: "external-thing", bindAddress: "127.0.0.1" },
    ]
    const ctx = {
      pidToWorkspace: new Map([
        [100, "workspace-a"],
        [200, "workspace-b"],
      ]),
    }
    const out = attribute(parsed, ctx)
    expect(out[0]).toMatchObject({ workspaceId: "workspace-a", external: false })
    expect(out[1]).toMatchObject({ workspaceId: "workspace-b", external: false })
    expect(out[2]?.external).toBe(true)
    expect(out[2]?.workspaceId).toBeUndefined()
  })
})
