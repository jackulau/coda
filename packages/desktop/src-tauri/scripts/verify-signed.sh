#!/usr/bin/env bash
# verify-signed.sh — post-build signature + Gatekeeper check for a .app bundle.
#
# Exit codes are defined in verify-signed-lib.ts (EXIT_* constants).
#   0 OK, 1 bad args, 2 codesign failed, 3 Gatekeeper rejected, 4 app missing
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "usage: verify-signed.sh <path-to-.app>" >&2
  exit 1
fi

APP_PATH="$1"

if [[ ! -e "$APP_PATH" ]]; then
  echo "app bundle not found: $APP_PATH" >&2
  exit 4
fi

echo "=== verify-signed ==="
echo "App: $APP_PATH"

# codesign --verify
if ! codesign --verify --deep --strict --verbose=4 "$APP_PATH" 2>&1; then
  echo "❌ codesign --verify failed for $APP_PATH" >&2
  exit 2
fi

# codesign -dv → extract identity (note: real codesign writes to stderr)
dv_out="$(codesign -dv --verbose=4 "$APP_PATH" 2>&1 || true)"
identity="$(echo "$dv_out" | grep -E '^Authority=Developer ID Application:' | head -1 | sed -E 's/^Authority=//')"

if [[ -n "$identity" ]]; then
  echo "Signed by: $identity"
else
  echo "⚠️  No Developer ID Application authority found in codesign -dv output" >&2
fi

# Gatekeeper assessment
if ! spctl --assess --type=execute --verbose=4 "$APP_PATH" 2>&1; then
  echo "❌ Gatekeeper rejected $APP_PATH" >&2
  exit 3
fi

echo "✅ verified signed + Gatekeeper accepted"
exit 0
