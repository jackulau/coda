#!/usr/bin/env bash
# notarize-credentials.sh — validate Apple notarization env vars and, with
# --store, persist them as an `xcrun notarytool store-credentials` profile so
# subsequent CI / ops runs don't need plaintext creds in the environment.
#
# Exit codes:
#   0  all three CODA_APPLE_* vars set
#   1  one or more missing (see printed instructions)
#   2  --store was requested but `xcrun notarytool store-credentials` failed
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

STORE=0
DRY_RUN=0
PROFILE_NAME="coda-notarize"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --store) STORE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --profile) PROFILE_NAME="$2"; shift 2 ;;
    -h|--help)
      cat <<'EOF'
notarize-credentials.sh [--store] [--dry-run] [--profile NAME]
  --store     Persist creds via `xcrun notarytool store-credentials`
  --dry-run   With --store, print the command instead of running it
  --profile   Keychain profile name (default: coda-notarize)
EOF
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

bun "$SCRIPT_DIR/notarize-credentials-cli.ts"
validation_exit=$?

if [[ $validation_exit -ne 0 ]]; then
  exit "$validation_exit"
fi

if [[ $STORE -eq 1 ]]; then
  if [[ -z "${CODA_APPLE_ID:-}" || -z "${CODA_APPLE_TEAM_ID:-}" || -z "${CODA_APPLE_APP_PASSWORD:-}" ]]; then
    echo "internal error: creds validated but not in env" >&2
    exit 2
  fi

  cmd=(xcrun notarytool store-credentials "$PROFILE_NAME"
       --apple-id "$CODA_APPLE_ID"
       --team-id "$CODA_APPLE_TEAM_ID"
       --password "$CODA_APPLE_APP_PASSWORD")

  if [[ $DRY_RUN -eq 1 ]]; then
    # Print without the password, for safe logs.
    echo "[dry-run] xcrun notarytool store-credentials $PROFILE_NAME --apple-id $CODA_APPLE_ID --team-id $CODA_APPLE_TEAM_ID --password <redacted>"
  else
    if ! "${cmd[@]}"; then
      echo "xcrun notarytool store-credentials failed" >&2
      exit 2
    fi
    echo "Stored credentials as keychain profile '$PROFILE_NAME'"
  fi
fi

exit 0
