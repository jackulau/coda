import { describe, expect, test } from "bun:test"
import { parseLsofOutput } from "./parser"

describe("port attribution via parser", () => {
  test("parses a minimal lsof IPv4 LISTEN entry", () => {
    const stdout = [
      "COMMAND    PID   USER  FD   TYPE DEVICE SIZE/OFF NODE NAME",
      "node     12345   jack   3   IPv4 0xdead      0t0  TCP 127.0.0.1:3000 (LISTEN)",
    ].join("\n")
    const rows = parseLsofOutput(stdout)
    expect(rows.length).toBe(1)
    expect(rows[0]).toMatchObject({ port: 3000, pid: 12345, command: "node" })
  })

  test("skips IPv6 and malformed rows", () => {
    const stdout = [
      "COMMAND    PID   USER  FD   TYPE DEVICE SIZE/OFF NODE NAME",
      "node     12345   jack   3   IPv4 0xdead      0t0  TCP 127.0.0.1:3000 (LISTEN)",
      "garbage line",
      "node     99999   jack   3   IPv6 0xbeef      0t0  TCP *:4000 (LISTEN)",
    ].join("\n")
    const rows = parseLsofOutput(stdout)
    expect(rows.length).toBe(2) // IPv6 valid with *:4000 → bindAddress='*'
    expect(rows.find((r) => r.port === 3000)).toBeDefined()
  })

  test("rejects invalid port numbers", () => {
    const stdout = [
      "COMMAND    PID   USER  FD   TYPE DEVICE SIZE/OFF NODE NAME",
      "node     12345   jack   3   IPv4 0xdead      0t0  TCP 127.0.0.1:99999 (LISTEN)",
      "node     12345   jack   3   IPv4 0xdead      0t0  TCP 127.0.0.1:0 (LISTEN)",
    ].join("\n")
    expect(parseLsofOutput(stdout).length).toBe(0)
  })

  test("parses multiple ports from same process", () => {
    const stdout = [
      "COMMAND    PID   USER  FD   TYPE DEVICE SIZE/OFF NODE NAME",
      "node     100   jack   3   IPv4 0x1      0t0  TCP 127.0.0.1:3000 (LISTEN)",
      "node     100   jack   4   IPv4 0x2      0t0  TCP 127.0.0.1:3001 (LISTEN)",
    ].join("\n")
    const rows = parseLsofOutput(stdout)
    expect(rows.map((r) => r.port).sort()).toEqual([3000, 3001])
  })

  test("empty input yields empty output", () => {
    expect(parseLsofOutput("")).toEqual([])
    expect(parseLsofOutput("HEADER ONLY")).toEqual([])
  })
})
