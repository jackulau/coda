export const en: Record<string, string> = {
  // Navigation sections
  "settings.appearance": "Appearance",
  "settings.keyboard": "Keyboard",
  "settings.terminal": "Terminal",
  "settings.updates": "Updates",
  "settings.git": "Git",
  "settings.about": "About",

  // Appearance section
  "settings.theme": "Theme",
  "settings.theme.description": "Dark theme only for now. Light theme is on the roadmap.",
  "settings.uiFontSize": "UI font size",
  "settings.uiFontSize.description": "Applies to sidebar, panels, and menus.",
  "settings.reducedMotion": "Reduce motion",
  "settings.reducedMotion.description": "Disable transitions and animations across the app.",

  // Keyboard section
  "settings.keyboard.description":
    "Read-only shortcut reference. Rebinding lands in a later release.",
  "settings.shortcut.commandPalette": "Command palette",
  "settings.shortcut.openSettings": "Open settings",
  "settings.shortcut.openFolder": "Open folder",
  "settings.shortcut.saveCurrentTab": "Save current tab",
  "settings.shortcut.closeCurrentTab": "Close current tab",
  "settings.shortcut.toggleSidebar": "Toggle sidebar",
  "settings.shortcut.revealInFinder": "Reveal in Finder",
  "settings.shortcut.search": "Search",

  // Terminal section
  "settings.terminalFontSize": "Font size",
  "settings.terminalFontSize.description": "Applies to all terminal panes.",
  "settings.terminalShell": "Default shell",
  "settings.terminalShell.description":
    "Leave empty to use the system default (SHELL env var on Unix, pwsh on Windows).",

  // Updates section
  "settings.updatesChannel": "Channel",
  "settings.updatesChannel.description": "Stable is safer; beta gets features earlier.",
  "settings.updatesChannel.stable": "Stable",
  "settings.updatesChannel.beta": "Beta",
  "settings.checkForUpdates": "Check for updates",
  "settings.checkForUpdates.description": "Runs immediately against the current channel.",
  "settings.checkForUpdates.button": "Check now",
  "settings.checkForUpdates.noUpdates": "No updates available. You are on the latest build.",

  // Git section
  "settings.githubPat": "GitHub personal access token",
  "settings.githubPat.description":
    "Scopes needed: repo, read:org. Stored in local browser storage.",
  "settings.githubPat.save": "Save",

  // About section
  "settings.about.description": "Agent-native IDE built on Tauri 2 + SolidJS.",

  // Close button
  "settings.close": "Close",
}
