export type GitHubErrorCode =
  | "unauthorized"
  | "rate_limited"
  | "not_found"
  | "repo_inaccessible"
  | "stale_position"
  | "pr_closed"
  | "self_approval"
  | "network"
  | "unknown"

export interface GitHubError {
  code: GitHubErrorCode
  message: string
  status?: number
  resetAt?: number
  retryable: boolean
}

export interface ErrorContext {
  status: number
  body?: { message?: string; documentation_url?: string }
  headers?: Record<string, string | undefined>
  resourceFound?: boolean
  reviewKind?: "approve" | "comment" | "request_changes"
}

export function classifyGitHubError(ctx: ErrorContext): GitHubError {
  const msg = ctx.body?.message ?? `HTTP ${ctx.status}`
  if (ctx.status === 401) {
    return { code: "unauthorized", message: msg, status: 401, retryable: false }
  }
  if (ctx.status === 403) {
    const remaining = ctx.headers?.["x-ratelimit-remaining"]
    const reset = ctx.headers?.["x-ratelimit-reset"]
    if (remaining === "0" && reset) {
      return {
        code: "rate_limited",
        message: msg,
        status: 403,
        resetAt: Number.parseInt(reset, 10),
        retryable: true,
      }
    }
    return { code: "unauthorized", message: msg, status: 403, retryable: false }
  }
  if (ctx.status === 404) {
    if (ctx.resourceFound === false) {
      return {
        code: "repo_inaccessible",
        message: "Repository not accessible to the authenticated user",
        status: 404,
        retryable: false,
      }
    }
    return { code: "not_found", message: msg, status: 404, retryable: false }
  }
  if (ctx.status === 422) {
    if (/closed/i.test(msg)) {
      return { code: "pr_closed", message: msg, status: 422, retryable: false }
    }
    return { code: "stale_position", message: msg, status: 422, retryable: true }
  }
  if (ctx.status === 409) {
    return { code: "pr_closed", message: msg, status: 409, retryable: false }
  }
  if (ctx.status >= 500) {
    return { code: "network", message: msg, status: ctx.status, retryable: true }
  }
  return { code: "unknown", message: msg, status: ctx.status, retryable: false }
}
