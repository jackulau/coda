export type TokenSource = "keychain" | "env" | "device-flow" | "missing"

export interface AuthTokenResult {
  token: string | null
  source: TokenSource
  warning?: string
}

export interface KeychainProvider {
  read(account: string): Promise<string | null>
  write(account: string, value: string): Promise<void>
  delete(account: string): Promise<void>
}

const KEYCHAIN_ACCOUNT = "github"

export class GitHubAuth {
  constructor(
    private readonly keychain: KeychainProvider | null,
    private readonly env: Record<string, string | undefined>,
  ) {}

  async resolveToken(): Promise<AuthTokenResult> {
    if (this.keychain) {
      try {
        const v = await this.keychain.read(KEYCHAIN_ACCOUNT)
        if (v && v.length > 0) return { token: v, source: "keychain" }
      } catch (err) {
        return {
          token: null,
          source: "missing",
          warning: `keychain unavailable: ${err instanceof Error ? err.message : String(err)}`,
        }
      }
    }

    const envToken = this.env.GITHUB_TOKEN ?? this.env.GH_TOKEN
    if (envToken && envToken.length > 0) {
      return {
        token: envToken,
        source: "env",
        warning: "Using GITHUB_TOKEN from env. Move it to OS keychain for security.",
      }
    }

    return { token: null, source: "missing" }
  }

  async storeToken(token: string): Promise<void> {
    if (!this.keychain) throw new Error("keychain provider unavailable")
    await this.keychain.write(KEYCHAIN_ACCOUNT, token)
  }

  async clearToken(): Promise<void> {
    if (!this.keychain) return
    await this.keychain.delete(KEYCHAIN_ACCOUNT)
  }
}

export class InMemoryKeychain implements KeychainProvider {
  private map = new Map<string, string>()
  read(account: string): Promise<string | null> {
    return Promise.resolve(this.map.get(account) ?? null)
  }
  write(account: string, value: string): Promise<void> {
    this.map.set(account, value)
    return Promise.resolve()
  }
  delete(account: string): Promise<void> {
    this.map.delete(account)
    return Promise.resolve()
  }
}
