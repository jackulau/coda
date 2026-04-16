#!/usr/bin/env bash
# build-mac.sh — signed macOS .app/.dmg build wrapper.
#
# Resolves the Developer ID Application identity (env override > login
# keychain), exports APPLE_SIGNING_IDENTITY + APPLE_TEAM_ID for Tauri, and
# invokes `bun tauri build` with the right target triple. Fails closed (exit
# 2) when nothing signable is available instead of producing an unsigned
# bundle labeled "signed".
#
# Env:
#   CODA_APPLE_DEV_ID   explicit "Developer ID Application: ..." identity
#   CODA_MAC_ARCH       arm64 | x64 | (unset → universal)
#   CODA_APPLE_TEAM_ID  explicit team id override (normally derived from CN)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_TAURI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SRC_TAURI_DIR/../../.." && pwd)"

usage_err() {
  cat >&2 <<'EOF'
build-mac.sh: no Developer ID Application identity found.

Fix one of:
  1) Install your Developer ID Application cert into the login keychain:
     Keychain Access → login → My Certificates → drag the .p12
  2) Set CODA_APPLE_DEV_ID to the full CN, e.g.:
     export CODA_APPLE_DEV_ID="Developer ID Application: Jack Lau (95ZR2Y4GKR)"

See packages/desktop/src-tauri/README_MAC_RELEASE.md for the full setup.
EOF
  exit 2
}

# Call the bun-native resolver so identity parsing, team-id extraction, and
# target-triple selection stay in one tested place.
resolve_identity() {
  local keychain_output=""
  if command -v security >/dev/null 2>&1; then
    keychain_output="$(security find-identity -v -p codesigning 2>/dev/null || true)"
  fi

  local env_override="${CODA_APPLE_DEV_ID:-}"
  local arch_in="${CODA_MAC_ARCH:-}"

  CODA_APPLE_DEV_ID="$env_override" \
  CODA_MAC_ARCH="$arch_in" \
  KEYCHAIN_OUTPUT="$keychain_output" \
  bun "$SCRIPT_DIR/build-mac-resolve.ts"
}

if ! output="$(resolve_identity)"; then
  usage_err
fi

# Parse "identity|team_id|target" from the resolver.
IFS='|' read -r identity team_id target <<<"$output"

if [[ -z "$identity" || "$identity" == "null" ]]; then
  usage_err
fi

if [[ -n "${CODA_APPLE_TEAM_ID:-}" ]]; then
  team_id="$CODA_APPLE_TEAM_ID"
fi

export APPLE_SIGNING_IDENTITY="$identity"
export APPLE_TEAM_ID="$team_id"

echo "=== build-mac ==="
echo "Identity: $APPLE_SIGNING_IDENTITY"
echo "Team ID:  $APPLE_TEAM_ID"
echo "Target:   $target"
echo "Repo:     $REPO_ROOT"
echo "=================="

cd "$REPO_ROOT"
exec bun --cwd packages/desktop tauri build --target "$target"
