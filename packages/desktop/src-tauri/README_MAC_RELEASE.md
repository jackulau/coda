# macOS Signed Release — Operator Guide

This is the end-to-end guide for shipping a code-signed, notarized macOS
build of Coda. All scripts referenced live next to this file in
`packages/desktop/src-tauri/scripts/`.

## What you need

You need **three** things to ship a signed + notarized release:

1. **Developer ID Application certificate** — issued by Apple through your
   paid Developer Program account. On the local machine it lives in the
   login keychain; in CI it is restored from a base64-encoded `.p12`.

2. **Apple ID and Team ID** — the Apple ID associated with the Developer
   account, plus the Team ID. For this project the Team ID is:

   ```text
   CODA_APPLE_TEAM_ID=95ZR2Y4GKR
   ```

3. **App-Specific Password** — a one-off password Apple issues per
   third-party automation. The notarize step uses this instead of your real
   Apple ID password.

   Generate one:

   1. Sign in at <https://appleid.apple.com>
   2. Navigate to **Sign-In and Security → App-Specific Passwords**
   3. Click **Generate an app-specific password** (or **+**)
   4. Name it `coda-notarize` (or anything memorable)
   5. Copy the 19-character password (format: `xxxx-xxxx-xxxx-xxxx`)
   6. Store it as `CODA_APPLE_APP_PASSWORD` in your shell / `.env`

## Local shipping checklist

From the repo root:

```bash
# 1) Build a signed .app + .dmg. Script auto-discovers your Developer ID
#    from the login keychain. Set CODA_APPLE_DEV_ID to override.
./packages/desktop/src-tauri/scripts/build-mac.sh

# 2) Verify the resulting .app is signed and Gatekeeper-accepted.
./packages/desktop/src-tauri/scripts/verify-signed.sh \
  packages/desktop/src-tauri/target/universal-apple-darwin/release/bundle/macos/Coda.app

# 3) Validate your notarization credentials are in env.
CODA_APPLE_ID=... CODA_APPLE_TEAM_ID=95ZR2Y4GKR CODA_APPLE_APP_PASSWORD=... \
  ./packages/desktop/src-tauri/scripts/notarize-credentials.sh

# 4) Submit for notarization + staple the ticket.
CODA_APPLE_ID=... CODA_APPLE_TEAM_ID=95ZR2Y4GKR CODA_APPLE_APP_PASSWORD=... \
  bun packages/desktop/src-tauri/scripts/notarize.ts \
  --bundle packages/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/Coda_*.dmg
```

### Arch override

By default `build-mac.sh` produces a universal binary. For a single-arch
build:

```bash
CODA_MAC_ARCH=arm64 ./packages/desktop/src-tauri/scripts/build-mac.sh
# or
CODA_MAC_ARCH=x64   ./packages/desktop/src-tauri/scripts/build-mac.sh
```

### Storing creds in the keychain

If you don't want to keep `CODA_APPLE_APP_PASSWORD` in your shell, persist
it into a keychain profile that `xcrun notarytool` can reuse:

```bash
CODA_APPLE_ID=... CODA_APPLE_TEAM_ID=95ZR2Y4GKR CODA_APPLE_APP_PASSWORD=... \
  ./packages/desktop/src-tauri/scripts/notarize-credentials.sh --store
```

## CI shipping (GitHub Actions)

The workflow `.github/workflows/release-macos.yml` runs on any tag push
matching `v*` and produces a signed, notarized `.dmg` as a GitHub Release
asset. It requires these repository secrets:

| Secret | Value | Source |
|---|---|---|
| `APPLE_CERT_P12_BASE64` | Base64 of the exported `.p12` | `base64 -i cert.p12 \| pbcopy` |
| `APPLE_CERT_P12_PASSWORD` | Password you used when exporting the `.p12` | your choice at export time |
| `APPLE_SIGNING_IDENTITY` | The exact CN, e.g. `Developer ID Application: Jack Lau (95ZR2Y4GKR)` | Keychain Access → right-click cert → Get Info |
| `APPLE_TEAM_ID` | `95ZR2Y4GKR` | from the CN above |
| `APPLE_ID` | Apple ID email used for notarization | Apple Developer account |
| `APPLE_APP_PASSWORD` | The app-specific password (not your real password) | appleid.apple.com |

### Exporting the `.p12` for CI

1. Open **Keychain Access**
2. Left sidebar: **login** → **My Certificates**
3. Right-click **Developer ID Application: Jack Lau** → **Export…**
4. Format: **Personal Information Exchange (.p12)**
5. Pick a password — you'll use this as `APPLE_CERT_P12_PASSWORD`
6. Save as `cert.p12` somewhere temporary
7. Base64-encode it and copy to clipboard:

   ```bash
   base64 -i cert.p12 | pbcopy
   ```

8. Paste into the **`APPLE_CERT_P12_BASE64`** repository secret
9. Paste the export password into **`APPLE_CERT_P12_PASSWORD`**
10. Delete `cert.p12` from disk:

    ```bash
    rm cert.p12
    ```

## Troubleshooting

**`build-mac.sh` exits 2 "no Developer ID Application identity found"**
You don't have the Developer ID Application cert in the login keychain
*and* `CODA_APPLE_DEV_ID` isn't set. Fix one of the two.

**`verify-signed.sh` exits 2 "codesign --verify failed"**
The bundle isn't signed, or the signature was broken (e.g. resources
modified after signing). Rebuild.

**`verify-signed.sh` exits 3 "Gatekeeper rejected"**
The bundle is signed but not notarized. Run the notarize step.

**Notarize returns `Invalid`**
Open the `notarytool log` for the submission ID. Usually this is a
missing hardened-runtime flag or a missing entitlement.

## Appendix — env vars at a glance

| Var | Used by | Required for |
|---|---|---|
| `CODA_APPLE_DEV_ID` | `build-mac.sh` | overriding keychain discovery |
| `CODA_MAC_ARCH` | `build-mac.sh` | `arm64` / `x64` (default: universal) |
| `APPLE_SIGNING_IDENTITY` | Tauri bundler | signing (set by `build-mac.sh`) |
| `APPLE_TEAM_ID` | Tauri bundler | signing (set by `build-mac.sh`) |
| `CODA_APPLE_ID` | `notarize.ts`, `notarize-credentials.sh` | notarization |
| `CODA_APPLE_TEAM_ID` | same as above | notarization — `95ZR2Y4GKR` |
| `CODA_APPLE_APP_PASSWORD` | same as above | notarization — app-specific password |
| `CODA_REQUIRE_SIGNED=1` | `signing-audit.ts` | fail-closed gate (prod) |
