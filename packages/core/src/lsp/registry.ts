// LSP registry — maps language IDs to their server launch metadata.
//
// Each entry describes how to find + launch a language server. Entries are
// data-only: they don't spawn anything, they describe what spawning would
// need. `installHint` is shown to users when the binary is missing.

export interface LspRegistryEntry {
  /** Stable language id (matches `textDocument.languageId`) */
  id: string
  name: string
  /** File extensions this server handles (no leading dot) */
  fileExtensions: string[]
  /** Executable name. Looked up on PATH or in $CODA_LSP_DIR/<id>/ */
  serverCommand: string
  serverArgs: string[]
  /** User-visible instructions for installing the server */
  installHint: string
  /** LSP document selector string for CodeMirror/VSCode-style activation */
  documentSelector: Array<{ scheme: "file"; language: string }>
  /** Optional SHA256 of a pinned release binary — used by the installer */
  releaseChecksum?: string
  /**
   * Optional mapping from os/arch to download URL. Used by the installer.
   */
  releaseUrls?: Partial<Record<
    "darwin-x64" | "darwin-arm64" | "linux-x64" | "linux-arm64" | "win32-x64",
    string
  >>
}

const R: LspRegistryEntry[] = [
  {
    id: "typescript",
    name: "TypeScript / JavaScript",
    fileExtensions: ["ts", "tsx", "mts", "cts", "js", "jsx", "mjs", "cjs"],
    serverCommand: "typescript-language-server",
    serverArgs: ["--stdio"],
    installHint: "npm i -g typescript-language-server typescript",
    documentSelector: [
      { scheme: "file", language: "typescript" },
      { scheme: "file", language: "javascript" },
    ],
  },
  {
    id: "javascript",
    name: "JavaScript (via TypeScript LS)",
    fileExtensions: ["js", "jsx", "mjs", "cjs"],
    serverCommand: "typescript-language-server",
    serverArgs: ["--stdio"],
    installHint: "npm i -g typescript-language-server typescript",
    documentSelector: [{ scheme: "file", language: "javascript" }],
  },
  {
    id: "python",
    name: "Python",
    fileExtensions: ["py", "pyi", "pyw"],
    serverCommand: "pylsp",
    serverArgs: [],
    installHint: "pip install python-lsp-server",
    documentSelector: [{ scheme: "file", language: "python" }],
  },
  {
    id: "rust",
    name: "Rust",
    fileExtensions: ["rs"],
    serverCommand: "rust-analyzer",
    serverArgs: [],
    installHint: "rustup component add rust-analyzer",
    documentSelector: [{ scheme: "file", language: "rust" }],
  },
  {
    id: "go",
    name: "Go",
    fileExtensions: ["go"],
    serverCommand: "gopls",
    serverArgs: [],
    installHint: "go install golang.org/x/tools/gopls@latest",
    documentSelector: [{ scheme: "file", language: "go" }],
  },
  {
    id: "java",
    name: "Java",
    fileExtensions: ["java"],
    serverCommand: "jdtls",
    serverArgs: [],
    installHint:
      "brew install jdtls (macOS) or download from https://download.eclipse.org/jdtls/",
    documentSelector: [{ scheme: "file", language: "java" }],
  },
  {
    id: "c",
    name: "C",
    fileExtensions: ["c", "h"],
    serverCommand: "clangd",
    serverArgs: ["--background-index"],
    installHint: "brew install llvm (macOS) or apt install clangd (Linux)",
    documentSelector: [{ scheme: "file", language: "c" }],
  },
  {
    id: "cpp",
    name: "C++",
    fileExtensions: ["cc", "cpp", "cxx", "hpp", "hxx"],
    serverCommand: "clangd",
    serverArgs: ["--background-index"],
    installHint: "brew install llvm (macOS) or apt install clangd (Linux)",
    documentSelector: [{ scheme: "file", language: "cpp" }],
  },
  {
    id: "csharp",
    name: "C#",
    fileExtensions: ["cs"],
    serverCommand: "omnisharp",
    serverArgs: ["--languageserver"],
    installHint: "dotnet tool install -g omnisharp",
    documentSelector: [{ scheme: "file", language: "csharp" }],
  },
  {
    id: "ruby",
    name: "Ruby",
    fileExtensions: ["rb", "rbs"],
    serverCommand: "solargraph",
    serverArgs: ["stdio"],
    installHint: "gem install solargraph",
    documentSelector: [{ scheme: "file", language: "ruby" }],
  },
  {
    id: "php",
    name: "PHP",
    fileExtensions: ["php"],
    serverCommand: "intelephense",
    serverArgs: ["--stdio"],
    installHint: "npm i -g intelephense",
    documentSelector: [{ scheme: "file", language: "php" }],
  },
  {
    id: "swift",
    name: "Swift",
    fileExtensions: ["swift"],
    serverCommand: "sourcekit-lsp",
    serverArgs: [],
    installHint: "bundled with Xcode (xcrun sourcekit-lsp)",
    documentSelector: [{ scheme: "file", language: "swift" }],
  },
  {
    id: "kotlin",
    name: "Kotlin",
    fileExtensions: ["kt", "kts"],
    serverCommand: "kotlin-language-server",
    serverArgs: [],
    installHint:
      "brew install kotlin-language-server (macOS) or download from https://github.com/fwcd/kotlin-language-server",
    documentSelector: [{ scheme: "file", language: "kotlin" }],
  },
  {
    id: "scala",
    name: "Scala",
    fileExtensions: ["scala", "sc"],
    serverCommand: "metals",
    serverArgs: [],
    installHint: "coursier install metals",
    documentSelector: [{ scheme: "file", language: "scala" }],
  },
  {
    id: "lua",
    name: "Lua",
    fileExtensions: ["lua"],
    serverCommand: "lua-language-server",
    serverArgs: [],
    installHint:
      "brew install lua-language-server (macOS) or download from https://github.com/LuaLS/lua-language-server",
    documentSelector: [{ scheme: "file", language: "lua" }],
  },
  {
    id: "bash",
    name: "Bash / Shell",
    fileExtensions: ["sh", "bash", "zsh", "ksh"],
    serverCommand: "bash-language-server",
    serverArgs: ["start"],
    installHint: "npm i -g bash-language-server",
    documentSelector: [{ scheme: "file", language: "shellscript" }],
  },
  {
    id: "html",
    name: "HTML",
    fileExtensions: ["html", "htm"],
    serverCommand: "vscode-html-language-server",
    serverArgs: ["--stdio"],
    installHint: "npm i -g vscode-langservers-extracted",
    documentSelector: [{ scheme: "file", language: "html" }],
  },
  {
    id: "css",
    name: "CSS / SCSS / Less",
    fileExtensions: ["css", "scss", "sass", "less"],
    serverCommand: "vscode-css-language-server",
    serverArgs: ["--stdio"],
    installHint: "npm i -g vscode-langservers-extracted",
    documentSelector: [
      { scheme: "file", language: "css" },
      { scheme: "file", language: "scss" },
    ],
  },
  {
    id: "json",
    name: "JSON",
    fileExtensions: ["json", "jsonc"],
    serverCommand: "vscode-json-language-server",
    serverArgs: ["--stdio"],
    installHint: "npm i -g vscode-langservers-extracted",
    documentSelector: [{ scheme: "file", language: "json" }],
  },
  {
    id: "yaml",
    name: "YAML",
    fileExtensions: ["yml", "yaml"],
    serverCommand: "yaml-language-server",
    serverArgs: ["--stdio"],
    installHint: "npm i -g yaml-language-server",
    documentSelector: [{ scheme: "file", language: "yaml" }],
  },
  {
    id: "markdown",
    name: "Markdown",
    fileExtensions: ["md", "markdown"],
    serverCommand: "marksman",
    serverArgs: ["server"],
    installHint:
      "brew install marksman (macOS) or download from https://github.com/artempyanykh/marksman",
    documentSelector: [{ scheme: "file", language: "markdown" }],
  },
  {
    id: "sql",
    name: "SQL",
    fileExtensions: ["sql"],
    serverCommand: "sqls",
    serverArgs: [],
    installHint: "go install github.com/sqls-server/sqls@latest",
    documentSelector: [{ scheme: "file", language: "sql" }],
  },
]

const byId = new Map<string, LspRegistryEntry>(R.map((e) => [e.id, e]))
const byExt = new Map<string, LspRegistryEntry>()
for (const e of R) {
  for (const ext of e.fileExtensions) {
    // First registration wins for a given extension — typescript handles js
    // files only if `javascript` isn't separately matched.
    if (!byExt.has(ext.toLowerCase())) {
      byExt.set(ext.toLowerCase(), e)
    }
  }
}

export function allServers(): readonly LspRegistryEntry[] {
  return R
}

export function getServer(id: string): LspRegistryEntry | null {
  return byId.get(id) ?? null
}

export function resolveForFile(path: string): LspRegistryEntry | null {
  const m = path.match(/\.([A-Za-z0-9]+)$/)
  if (!m) return null
  return byExt.get(m[1].toLowerCase()) ?? null
}

/**
 * Check whether a given language server is installed. Accepts a resolver
 * that checks PATH or the bundled dir; pass `{ onPath, bundledDir }`.
 * This function stays pure-logic — the FS/exec side is injected so the
 * tests don't need a filesystem.
 */
export interface IsInstalledProbe {
  existsOnPath(command: string): boolean
  existsInDir(dir: string, command: string): boolean
}

export function isInstalled(
  id: string,
  probe: IsInstalledProbe,
  bundledDir = "",
): boolean {
  const entry = byId.get(id)
  if (!entry) return false
  if (probe.existsOnPath(entry.serverCommand)) return true
  if (bundledDir && probe.existsInDir(bundledDir, entry.serverCommand))
    return true
  return false
}
