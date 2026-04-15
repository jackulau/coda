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

```bash
bun install
bun run typecheck
bun run lint
bun run dev          # SolidJS app in browser
bun run tauri dev    # Full desktop shell (requires Rust toolchain)
```

## Targets

- Cold start ≤ 1.5 s (local), ≤ 3 s (CI)
- Worktree switch p95 ≤ 50 ms
- Terminal scroll 120 fps on M-series, ≥ 60 fps floor
- Zero data loss across restart
- Crash in one worktree never affects siblings
