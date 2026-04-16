# Autonomous stophook loop

Phase 0 execution harness. One invocation does one atomic unit, then exits.
External loop calls repeatedly.

## First-time setup

```bash
# Seed the task state from the spec outline
bun scripts/stophook.ts --seed
```

This writes `tasks/coda-v2-agent-native-ide/TASKS.json` with all Phase A/B/C/...
tasks as `pending`. The directory is gitignored — local state only.

## Loop

```bash
# In a stop hook or loop:
while true; do
  if [ -f ~/.coda/stophook.stop ]; then break; fi
  bun scripts/stophook.ts --plan       # picks next task, marks in_progress
  # ... implementation happens here (agent writes files) ...
  bun scripts/stophook.ts --verify <id>  # runs verification, marks verified/failed
done
```

## Commands

| Command | What it does |
|---|---|
| `--seed` | Write a fresh `TASKS.json` with the seed list |
| `--status` | Print counts by status |
| `--plan [id]` | Pick next pending task (deps satisfied), mark in_progress |
| `--verify <id>` | Run the task's verification command, mark verified on exit-0 or failed/blocked |
| `--tasks <path>` | Use an alternate TASKS.json location |

## Gates

```bash
bun scripts/phase-gate.ts A        # exit 0 if every Phase A task is verified
bun scripts/phase-gate.ts --all
```

## Idempotency

```bash
bun scripts/verify-idempotent.ts A1            # runs the verification twice, diffs
bun scripts/verify-idempotent.ts --dry-run A1  # prints what it would do
```

## Stop sentinel

```bash
touch ~/.coda/stophook.stop   # next --plan exits 0 with reason=stop-file-present
rm ~/.coda/stophook.stop      # resume
```

## Env overrides

- `CODA_TASKS_PATH` — alt path to TASKS.json
- `CODA_STOP_FILE` — alt stop-file location
- `CODA_MAX_ATTEMPTS` — attempts before a task is marked `blocked` (default 5)
