#!/usr/bin/env bash
# build-linux.sh — Linux release bundle wrapper.
#
# Runs `tauri build` targeting deb + rpm + AppImage, then:
#   - When LINUX_GPG_KEY_ID is set: detached-signs the AppImage and writes
#     SIGNED.txt with the fingerprint.
#   - Otherwise: writes UNSIGNED.txt explaining what that means for users.
#
# deb and rpm are never bundle-signed here — that's repo-manager territory
# (apt / dnf pick up signatures from the repository, not the bundle). Bundling
# a detached `.deb.asc` would just confuse installers.
#
# Env:
#   LINUX_GPG_KEY_ID   fingerprint/email/keyid of an imported gpg key;
#                      unset → unsigned path

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_TAURI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SRC_TAURI_DIR/../../.." && pwd)"

cd "$REPO_ROOT"

echo "=== build-linux ==="
echo "Repo:   $REPO_ROOT"
echo "Target: x86_64-unknown-linux-gnu"
echo "Signed: $([[ -n "${LINUX_GPG_KEY_ID:-}" ]] && echo yes || echo no)"
echo "==================="

bun --cwd packages/desktop tauri build \
  --target x86_64-unknown-linux-gnu \
  --bundles deb,rpm,appimage

BUNDLE_DIR="$SRC_TAURI_DIR/target/x86_64-unknown-linux-gnu/release/bundle"
APPIMAGE_DIR="$BUNDLE_DIR/appimage"

# Locate the freshly-built AppImage. If tauri didn't produce one, fail loudly.
APPIMAGE_PATH="$(find "$APPIMAGE_DIR" -maxdepth 1 -type f -name '*.AppImage' | head -1 || true)"
if [[ -z "$APPIMAGE_PATH" ]]; then
  echo "build-linux.sh: no .AppImage in $APPIMAGE_DIR" >&2
  exit 1
fi

if [[ -n "${LINUX_GPG_KEY_ID:-}" ]]; then
  echo "Signing AppImage with key $LINUX_GPG_KEY_ID"
  gpg --batch --yes --local-user "$LINUX_GPG_KEY_ID" --detach-sign --armor --output "${APPIMAGE_PATH}.asc" "$APPIMAGE_PATH"

  FINGERPRINT="$(gpg --fingerprint --with-colons "$LINUX_GPG_KEY_ID" \
    | awk -F: '/^fpr:/{print $10; exit}')"

  cat > "$APPIMAGE_DIR/SIGNED.txt" <<EOF
Coda Linux AppImage — signed
============================

Key ID:      $LINUX_GPG_KEY_ID
Fingerprint: ${FINGERPRINT:-<not derivable>}

Verify:
  gpg --verify Coda.AppImage.asc Coda.AppImage

deb / rpm are intentionally not bundle-signed; install via a signed
apt/dnf repository if you need authenticity + integrity for those.
EOF
  echo "Wrote $APPIMAGE_DIR/SIGNED.txt"
else
  cat > "$APPIMAGE_DIR/UNSIGNED.txt" <<'EOF'
Coda Linux AppImage — UNSIGNED
==============================

This AppImage ships without a detached GPG signature. `gpg --verify` is
not possible — if you need to prove the binary is authentic, build from
source or wait for a signed release.

To opt into signing: set LINUX_GPG_KEY_BASE64 + LINUX_GPG_KEY_ID secrets
on the release workflow (see README_CROSS_PLATFORM.md).

deb / rpm are intentionally never bundle-signed; install via a signed
apt/dnf repository to get authenticity + integrity for those bundles.
EOF
  echo "Wrote $APPIMAGE_DIR/UNSIGNED.txt"
fi

echo "Done."
