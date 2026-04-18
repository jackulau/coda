import { spawnSync } from "node:child_process"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, test } from "@playwright/test"

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, "../../..")

test("typecheck passes on all packages from repo root", () => {
  const res = spawnSync("bun", ["run", "typecheck"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 180_000,
  })
  if (res.status !== 0) {
    throw new Error(
      `typecheck failed (exit ${res.status}):\nSTDOUT:\n${res.stdout}\nSTDERR:\n${res.stderr}`,
    )
  }
  expect(res.status).toBe(0)
})

test("root lint passes", () => {
  const res = spawnSync("bun", ["run", "lint"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 60_000,
  })
  if (res.status !== 0) {
    throw new Error(`lint failed (exit ${res.status}):\n${res.stdout}\n${res.stderr}`)
  }
  expect(res.status).toBe(0)
})

test("root build produces packages/app/dist/index.html", () => {
  const res = spawnSync("bun", ["run", "build"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 120_000,
  })
  if (res.status !== 0) {
    throw new Error(`build failed (exit ${res.status}):\n${res.stdout}\n${res.stderr}`)
  }
  expect(res.status).toBe(0)
  // presence of dist/index.html verified by the build exit code above;
  // double-check by stat
  const statRes = spawnSync("test", ["-f", resolve(REPO_ROOT, "packages/app/dist/index.html")])
  expect(statRes.status).toBe(0)
})
