# build-windows.ps1 — Windows release bundle wrapper.
#
# Runs `tauri build` targeting msi + nsis, then:
#   - When WINDOWS_PFX_PATH + WINDOWS_PFX_PASSWORD are set: signs the .msi
#     and the NSIS -setup.exe with signtool using SHA-256 and a trusted
#     RFC 3161 timestamp server, and writes SIGNED.txt.
#   - Otherwise: writes UNSIGNED.txt explaining the SmartScreen prompt users
#     will hit on first launch.
#
# Env:
#   WINDOWS_PFX_PATH       path to decoded .pfx cert; unset → unsigned path
#   WINDOWS_PFX_PASSWORD   password for the pfx

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$SrcTauriDir = Resolve-Path (Join-Path $ScriptDir "..")
$RepoRoot = Resolve-Path (Join-Path $SrcTauriDir "../../..")

Push-Location $RepoRoot
try {
    $pfxPath = $env:WINDOWS_PFX_PATH
    $pfxPwd = $env:WINDOWS_PFX_PASSWORD
    $signed = $false

    if ($pfxPath -and (Test-Path $pfxPath)) {
        if (-not $pfxPwd) {
            Write-Error "WINDOWS_PFX_PATH set but WINDOWS_PFX_PASSWORD missing — refusing to build."
            exit 1
        }
        $signed = $true
    }

    Write-Host "=== build-windows ==="
    Write-Host "Repo:   $RepoRoot"
    Write-Host "Target: x86_64-pc-windows-msvc"
    Write-Host "Signed: $signed"
    Write-Host "====================="

    bun --cwd packages/desktop tauri build `
        --target x86_64-pc-windows-msvc `
        --bundles msi,nsis
    if ($LASTEXITCODE -ne 0) {
        Write-Error "tauri build exited $LASTEXITCODE"
        exit $LASTEXITCODE
    }

    $BundleDir = Join-Path $SrcTauriDir "target/x86_64-pc-windows-msvc/release/bundle"
    $MsiDir = Join-Path $BundleDir "msi"
    $NsisDir = Join-Path $BundleDir "nsis"

    $TimestampUrl = "http://timestamp.digicert.com"

    if ($signed) {
        # signtool comes from the Windows SDK. On GitHub runners it is
        # already on PATH; otherwise we'd need to discover it via
        # vswhere.
        $msiFiles = Get-ChildItem -Path $MsiDir -Filter "*.msi" -ErrorAction SilentlyContinue
        $exeFiles = Get-ChildItem -Path $NsisDir -Filter "*-setup.exe" -ErrorAction SilentlyContinue

        foreach ($file in @($msiFiles) + @($exeFiles)) {
            if ($null -eq $file) { continue }
            Write-Host "Signing $($file.FullName)"
            signtool sign `
                /f $pfxPath `
                /p $pfxPwd `
                /fd sha256 `
                /td sha256 `
                /tr $TimestampUrl `
                $file.FullName
            if ($LASTEXITCODE -ne 0) {
                Write-Error "signtool failed on $($file.FullName) ($LASTEXITCODE)"
                exit $LASTEXITCODE
            }
        }

        $statusPath = Join-Path $BundleDir "SIGNED.txt"
        @"
Coda Windows installers — signed (Authenticode)
===============================================

Signed with: $pfxPath
Digest:      SHA-256
Timestamp:   $TimestampUrl

Verify with:
  signtool verify /pa /v Coda-<version>-setup.exe
  signtool verify /pa /v Coda_<version>_x64_en-US.msi
"@ | Out-File -FilePath $statusPath -Encoding utf8
        Write-Host "Wrote $statusPath"
    }
    else {
        $statusPath = Join-Path $BundleDir "UNSIGNED.txt"
        @"
Coda Windows installers — UNSIGNED
==================================

Windows SmartScreen will show "Windows protected your PC" the first time
a user runs the installer. They'll have to click More info → Run anyway.
This is Microsoft's built-in guard against unknown publishers; it clears
once the binary accumulates reputation OR once the build pipeline adds a
valid Authenticode signature.

To opt into signing: set WINDOWS_PFX_BASE64 + WINDOWS_PFX_PASSWORD secrets
on the release workflow (see README_CROSS_PLATFORM.md).
"@ | Out-File -FilePath $statusPath -Encoding utf8
        Write-Host "Wrote $statusPath"
    }

    Write-Host "Done."
}
finally {
    Pop-Location
}
