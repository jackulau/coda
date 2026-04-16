# Cross-Platform Release — Operator Guide

Coda ships three native installers on every `v*` tag push:

| Platform | Bundles | Default state | Signing gate |
|---|---|---|---|
| macOS | `.dmg` (universal arm64 + x86_64) | **signed + notarized** (pending Apple DPLA renewal) | `APPLE_CERT_P12_BASE64` + `APPLE_SIGNING_IDENTITY` + `APPLE_ID` + `APPLE_APP_PASSWORD` |
| Windows | `.msi`, `-setup.exe` (NSIS) | **unsigned** | `WINDOWS_PFX_BASE64` + `WINDOWS_PFX_PASSWORD` |
| Linux | `.deb`, `.rpm`, `.AppImage` | **unsigned** | `LINUX_GPG_KEY_BASE64` + `LINUX_GPG_KEY_ID` |

The unified workflow lives at `.github/workflows/release.yml`. It fans out
on tag push to a 3-OS matrix (`macos-14`, `ubuntu-22.04`, `windows-latest`)
and uploads every artifact to the GitHub release matching the tag. Each OS
runs independently (`fail-fast: false`), so a regression on one platform
doesn't block the others.

## Current state

- **macOS**: pipeline fully signs + notarizes once the Apple Developer Program
  License Agreement is re-accepted on the account. The scripts and secrets are
  already in place — see `README_MAC_RELEASE.md` for setup.
- **Windows**: ships **unsigned** today. Users will see a SmartScreen prompt.
  The pipeline already has the signing branch wired; flipping it on is purely
  a matter of adding the `WINDOWS_PFX_BASE64` + `WINDOWS_PFX_PASSWORD` secrets.
- **Linux**: ships **unsigned AppImage** today. deb/rpm are never bundle-signed
  here (by convention; those get signed by the repository, not the bundle).
  Adding `LINUX_GPG_KEY_BASE64` + `LINUX_GPG_KEY_ID` enables a detached-signature
  AppImage on every release.

Every artifact ships with either a `SIGNED.txt` or `UNSIGNED.txt` sibling so
downstream users can tell at a glance what they got.

## macOS

The deep guide is in [`README_MAC_RELEASE.md`](./README_MAC_RELEASE.md). Short
version:

- Requires a paid Apple Developer Program membership in good standing. The
  **Apple Developer Program License Agreement (DPLA)** has to be accepted on
  the account — Apple rotates this roughly yearly, and until it's re-accepted
  the notarize step fails with a clear "Agreement update needed" error.
- Secrets: `APPLE_CERT_P12_BASE64`, `APPLE_CERT_P12_PASSWORD`,
  `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_ID`, `APPLE_APP_PASSWORD`.
- Build script: `scripts/build-mac.sh`. Verifier: `scripts/verify-signed.sh`.
  Notarize: `scripts/notarize.ts`.

## Windows

### What users see on unsigned builds

Windows SmartScreen shows **"Windows protected your PC"** on first launch of
an unsigned installer. Users have to click **More info → Run anyway**. This
is normal; it doesn't mean the installer is broken, just that it's signed
by nobody SmartScreen has seen before. Trust builds over time based on the
number of users who run it, or is granted immediately by an Authenticode
certificate.

### Getting a code-signing certificate

Prices as of 2026:

- **Sectigo (Comodo)** — OV code signing ~$180/year (3yr ~$350 total).
  EV code signing ~$360/year. EV clears SmartScreen instantly; OV accumulates
  reputation slowly.
- **Certum** — Open Source code signing certificate, ~$80/year. Cheapest
  legit option for OSS projects; OV level, so the SmartScreen reputation
  warmup applies.
- **SSL.com** — OV ~$170/year, EV ~$310/year. Comparable to Sectigo.
- **DigiCert** — premium tier, $500+/year. Buy this if you need fastest
  issuance or white-glove support.

EV certs require a hardware token (YubiKey / SafeNet) and an in-person or
video-call identity check. OV certs are email + document based.

### Enabling signing in CI

Once you have a `.pfx`:

```bash
base64 -i mycert.pfx | pbcopy
# Paste into GitHub → Settings → Secrets → Actions as WINDOWS_PFX_BASE64
```

Then add `WINDOWS_PFX_PASSWORD` with the PFX password. The workflow's
Windows path auto-detects the secret and flips the `build-windows.ps1`
wrapper into the signed branch — no code change required.

The signing uses SHA-256 with an RFC 3161 timestamp from
`http://timestamp.digicert.com`. Signed binaries remain verifiable after the
cert expires, so long as the signature was timestamped before expiry.

## Linux

### What users see on unsigned AppImages

AppImages run without system-level gates — users can just
`chmod +x Coda.AppImage && ./Coda.AppImage`. The "unsigned" cost is that the
`gpg --verify` step is not available, so users have no cryptographic way
to prove the binary is the one we built.

deb and rpm are a different conversation. In practice users install them
via `apt` or `dnf`, which verify the **repository's** GPG signature, not
a signature on the bundle itself. Bundle-signing a `.deb` would be mostly
theatre — almost nothing consumes `.deb.asc`. Ship via a signed apt/dnf
repository if you need authenticity + integrity for deb/rpm.

### Generating a GPG signing key

```bash
gpg --full-gen-key
# Select:
#   (1) RSA and RSA
#   Key size: 4096
#   Expires: 2y (or longer if you're sure)
#   Real name, email (these become the key's identity)
#   Passphrase (use a password manager)

# Export the fingerprint:
gpg --list-secret-keys --keyid-format LONG
#   → sec  rsa4096/ABCDEF0123456789 ...

# Export the full key (private!) for CI:
gpg --export-secret-keys --armor ABCDEF0123456789 | base64 | pbcopy

# Also export just the public key for users to import before verifying:
gpg --export --armor ABCDEF0123456789 > coda-release-pubkey.asc
```

Publish `coda-release-pubkey.asc` on the release page so users can run
`gpg --import coda-release-pubkey.asc && gpg --verify Coda.AppImage.asc`.

### Enabling signing in CI

Add two secrets:

- `LINUX_GPG_KEY_BASE64` — the base64-encoded private key
- `LINUX_GPG_KEY_ID` — the key ID / fingerprint / email that identifies the
  key to `gpg --local-user`

The `build-linux.sh` wrapper auto-detects `LINUX_GPG_KEY_ID` and flips into
the signed branch, emitting a detached `.AppImage.asc`. deb/rpm are left
alone — those get signed by the repository manager, not the bundle.

## Secrets cheat sheet

| Secret | Scope | Required | Purpose |
|---|---|---|---|
| `APPLE_CERT_P12_BASE64` | macOS | yes (signed) | Developer ID Application cert |
| `APPLE_CERT_P12_PASSWORD` | macOS | yes (signed) | password for the p12 |
| `APPLE_SIGNING_IDENTITY` | macOS | yes (signed) | e.g. `Developer ID Application: Name (TEAMID)` |
| `APPLE_TEAM_ID` | macOS | yes (signed) | 10-char team ID |
| `APPLE_ID` | macOS | yes (notarize) | Apple ID email |
| `APPLE_APP_PASSWORD` | macOS | yes (notarize) | app-specific password |
| `WINDOWS_PFX_BASE64` | Windows | opt-in | base64 `.pfx` cert |
| `WINDOWS_PFX_PASSWORD` | Windows | opt-in | pfx password |
| `LINUX_GPG_KEY_BASE64` | Linux | opt-in | base64 ASCII-armored secret key |
| `LINUX_GPG_KEY_ID` | Linux | opt-in | key ID for `gpg --local-user` |

All secrets live in **GitHub → Settings → Secrets and variables → Actions**.
Windows and Linux "opt-in" means: unset → workflow builds unsigned, emits
`UNSIGNED.txt`, and logs a warning step. No build break.
