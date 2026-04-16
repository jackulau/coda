import { describe, expect, test } from "bun:test"
import { PortInfo } from "@coda/core/port"
import { parseLsofOutput } from "@coda/core/port/parser"

describe("port scanner parser (H1)", () => {
  test("parses lsof output", () => {
    const stdout = [
      "COMMAND    PID  USER  FD  TYPE DEVICE SIZE/OFF NODE NAME",
      "node      200  jack   3  IPv4 0x1       0t0  TCP 127.0.0.1:3000 (LISTEN)",
    ].join("\n")
    const rows = parseLsofOutput(stdout)
    expect(rows.length).toBe(1)
    expect(rows[0]?.port).toBe(3000)
  })

  test("returns empty array for empty input", () => {
    expect(parseLsofOutput("")).toEqual([])
  })
})
