// platform-signing-report.ts — generates the per-release signing-status
// block that gets pasted into the GitHub release body. Keeps Gatekeeper /
// SmartScreen / AppImage warning text colocated so tweaks don't drift
// between platforms.

export type PlatformStatus = "signed" | "unsigned" | "skipped"

export interface SigningInput {
  macos: PlatformStatus
  windows: PlatformStatus
  linux: PlatformStatus
  /** Only meaningful when macos==="signed". Defaults to true. */
  macosNotarized?: boolean
}

const MAC_LABEL = "macOS"
const WIN_LABEL = "Windows"
const LNX_LABEL = "Linux"

function macLine(status: PlatformStatus, notarized: boolean): string {
  if (status === "skipped") return `- ${MAC_LABEL}: skipped`
  if (status === "unsigned") return `- ${MAC_LABEL}: **unsigned**`
  if (!notarized) return `- ${MAC_LABEL}: signed but not notarized`
  return `- ${MAC_LABEL}: signed and notarized`
}

function winLine(status: PlatformStatus): string {
  if (status === "skipped") return `- ${WIN_LABEL}: skipped`
  if (status === "unsigned") return `- ${WIN_LABEL}: **unsigned**`
  return `- ${WIN_LABEL}: signed (Authenticode)`
}

function lnxLine(status: PlatformStatus): string {
  if (status === "skipped") return `- ${LNX_LABEL}: skipped`
  if (status === "unsigned")
    return `- ${LNX_LABEL}: **unsigned** AppImage (deb/rpm are never bundle-signed)`
  return `- ${LNX_LABEL}: AppImage GPG-signed (deb/rpm are never bundle-signed)`
}

function macGuidance(status: PlatformStatus, notarized: boolean): string | null {
  if (status === "unsigned") {
    return [
      `**${MAC_LABEL}** — macOS Gatekeeper will refuse to open the app on first launch ("cannot be opened because it is from an unidentified developer"). Right-click the app → Open → Open anyway, or clear the quarantine attribute with \`xattr -dr com.apple.quarantine Coda.app\`.`,
    ].join("\n")
  }
  if (status === "signed" && !notarized) {
    return [
      `**${MAC_LABEL}** — the build is signed but not notarized. Gatekeeper still prompts on first launch ("Coda is an app downloaded from the Internet. Are you sure you want to open it?"). Click Open. Subsequent launches are quiet.`,
    ].join("\n")
  }
  return null
}

function winGuidance(status: PlatformStatus): string | null {
  if (status !== "unsigned") return null
  return [
    `**${WIN_LABEL}** — Windows SmartScreen will show "Windows protected your PC" on first launch. Click **More info → Run anyway**. SmartScreen trust builds over time as more users run the binary; a code-signing certificate removes the prompt.`,
  ].join("\n")
}

function lnxGuidance(status: PlatformStatus): string | null {
  if (status !== "unsigned") return null
  return [
    `**${LNX_LABEL}** — the AppImage is distributed without a detached signature, so \`gpg --verify Coda.AppImage.asc\` is unverifiable. deb and rpm bundles are not bundle-signed by convention — install via a signed apt/dnf repository to get authenticity + integrity.`,
  ].join("\n")
}

function allSignedHappyPath(input: SigningInput): boolean {
  if (input.macos !== "signed" || input.windows !== "signed" || input.linux !== "signed") {
    return false
  }
  const notarized = input.macosNotarized ?? true
  return notarized
}

export function generateReport(input: SigningInput): string {
  const notarized = input.macosNotarized ?? true
  const lines: string[] = ["## Signing status", ""]

  lines.push(macLine(input.macos, notarized))
  lines.push(winLine(input.windows))
  lines.push(lnxLine(input.linux))
  lines.push("")

  if (allSignedHappyPath(input)) {
    lines.push("All builds signed and verified.")
    return lines.join("\n")
  }

  const guidance = [
    macGuidance(input.macos, notarized),
    winGuidance(input.windows),
    lnxGuidance(input.linux),
  ].filter((x): x is string => x !== null)

  if (guidance.length > 0) {
    lines.push("### What this means for users")
    lines.push("")
    for (const block of guidance) {
      lines.push(block)
      lines.push("")
    }
  }

  return lines.join("\n").replace(/\n+$/, "\n")
}
