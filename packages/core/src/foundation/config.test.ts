import { describe, expect, test } from "bun:test"
import { BiomeConfig, PackageJson, auditFoundation } from "./config"

describe("BiomeConfig schema", () => {
  test("parses minimal config", () => {
    expect(BiomeConfig.parse({})).toEqual({})
  })

  test("parses realistic config from repo", () => {
    const real = {
      $schema: "https://biomejs.dev/schemas/1.9.4/schema.json",
      linter: { enabled: true },
      formatter: { enabled: true },
    }
    expect(BiomeConfig.parse(real)).toMatchObject({ linter: { enabled: true } })
  })
})

describe("PackageJson schema", () => {
  test("accepts workspace monorepo shape", () => {
    const pkg = { name: "root", private: true, workspaces: ["packages/*"] }
    expect(PackageJson.parse(pkg).workspaces).toEqual(["packages/*"])
  })

  test("rejects missing name", () => {
    expect(() => PackageJson.parse({})).toThrow()
  })
})

describe("auditFoundation", () => {
  test("valid configs → configValid true", () => {
    const a = auditFoundation(
      { linter: { enabled: true } },
      {
        name: "x",
        workspaces: ["packages/*"],
        scripts: { test: "vitest", lint: "biome", typecheck: "tsc" },
      },
    )
    expect(a.configValid).toBe(true)
    expect(a.workspacesDeclared).toBe(true)
    expect(a.missingScripts).toEqual([])
  })

  test("missing scripts flagged", () => {
    const a = auditFoundation({}, { name: "x", scripts: { test: "vitest" } })
    expect(a.missingScripts.sort()).toEqual(["lint", "typecheck"])
  })

  test("non-monorepo flagged as workspacesDeclared false", () => {
    const a = auditFoundation({}, { name: "x", scripts: { test: "", lint: "", typecheck: "" } })
    expect(a.workspacesDeclared).toBe(false)
  })

  test("invalid json → configValid false", () => {
    const a = auditFoundation({}, null)
    expect(a.configValid).toBe(false)
  })
})
