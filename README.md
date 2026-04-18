# Coda

Agent-native IDE built on Tauri 2 + SolidJS, with per-worktree persistent agent sessions, built-in browser inspector, GitHub PR review, and crash-isolated multi-agent orchestration.

## Architecture

Monorepo (Bun workspaces):

- `packages/ui` — design tokens + headless primitives
- `packages/core` — TypeScript types, schemas, sidecar protocol, storage
- `packages/app` — SolidJS frontend (renderer)
- `packages/desktop` — Tauri 2 Rust shell (`src-tauri/`)

## Tech

- **Shell**: Tauri 2 (Rust) — native menu bar, OS keychain, webview-per-platform
- **Frontend**: SolidJS — fine-grained reactivity, no VDOM
- **Editor**: CodeMirror 6 (planned) — LSP via 22 language servers
- **Terminal**: Ghostty (WASM) — GPU-accelerated, multiplexed
- **Diff**: `@codemirror/merge` — split + unified, word-level
- **Storage**: Drizzle ORM (sidecar) + rusqlite (Rust)
- **Protocol**: HMAC-authenticated JSON-RPC between renderer and sidecar
- **Lint/format**: Biome
- **Tests**: Vitest + Playwright + `cargo test`

## Status

Foundation scaffold. Real implementation lives behind the spec phases (A → X). See `/spec` for the full roadmap.

## Dev

**Apple Silicon note — check this first.** The Tauri CLI loads a native
`@tauri-apps/cli-darwin-arm64` binding at install time. If your Node was installed
as x86_64 (common with older `nvm`), the `tauri` command crashes before it prints
anything useful. Confirm with `node -e "console.log(process.arch)"` — it must print
`arm64`. If it prints `x64`, install an arm64 Node (`nvm install 22`) and run Tauri
commands under that PATH, e.g.:

```bash
PATH="$HOME/.nvm/versions/node/v22.19.0/bin:$PATH" bun run tauri dev
```

Once Node is arm64:

```bash
bun install
bun run tauri dev    # Full desktop shell (arm64 Node + Rust toolchain)

# Or, for fast UI-only iteration (no Rust rebuilds):
bun run dev          # SolidJS app in browser at http://127.0.0.1:1420

bun run typecheck
bun run lint
bun run test         # core + ui + app (bun:test + vitest)
```

## Targets

- Cold start ≤ 1.5 s (local), ≤ 3 s (CI)
- Worktree switch p95 ≤ 50 ms
- Terminal scroll 120 fps on M-series, ≥ 60 fps floor
- Zero data loss across restart
- Crash in one worktree never affects siblings
