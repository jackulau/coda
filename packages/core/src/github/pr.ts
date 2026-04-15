import { z } from "zod"
import { codaBus } from "../event/bus"
import type { GitHubError } from "./error"
import { classifyGitHubError } from "./error"
import { type PrFile, type PrView, PrView as PrViewSchema } from "./index"

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean
  status: number
  headers: { get(name: string): string | null }
  json(): Promise<unknown>
  text(): Promise<string>
}>

const PR_GET_TTL_MS = 60_000

interface CacheEntry {
  view: PrView
  fetchedAt: number
  headSha: string
}

export interface PrClientOptions {
  fetch: FetchLike
  token: string | null
  baseUrl?: string
  currentUser?: string
  now?: () => number
}

export interface ListPrsArgs {
  owner: string
  repo: string
  state?: "open" | "closed" | "all"
  limit?: number
}

export interface GetPrArgs {
  owner: string
  repo: string
  number: number
}

export type ReviewKind = "APPROVE" | "COMMENT" | "REQUEST_CHANGES"

export interface ReviewArgs {
  owner: string
  repo: string
  number: number
  kind: ReviewKind
  body?: string
}

export class PrClient {
  private readonly baseUrl: string
  private readonly cache = new Map<string, CacheEntry>()
  private readonly now: () => number

  constructor(private readonly opts: PrClientOptions) {
    this.baseUrl = opts.baseUrl ?? "https://api.github.com"
    this.now = opts.now ?? (() => Date.now())
  }

  async list(args: ListPrsArgs): Promise<PrView[]> {
    const state = args.state ?? "open"
    const limit = Math.min(args.limit ?? 30, 100)
    const url = `${this.baseUrl}/repos/${args.owner}/${args.repo}/pulls?state=${state}&per_page=${limit}`
    const res = await this.fetch(url)
    if (!res.ok) throw await this.toError(res)
    const data = (await res.json()) as unknown[]
    return data.map((p) => mapListItem(p as Record<string, unknown>))
  }

  async get(args: GetPrArgs): Promise<PrView> {
    const cacheKey = `${args.owner}/${args.repo}#${args.number}`
    const cached = this.cache.get(cacheKey)
    const baseUrl = `${this.baseUrl}/repos/${args.owner}/${args.repo}/pulls/${args.number}`
    const headRes = await this.fetch(baseUrl)
    if (!headRes.ok) throw await this.toError(headRes)
    const detail = (await headRes.json()) as Record<string, unknown>
    const headSha = String((detail.head as { sha?: string } | undefined)?.sha ?? "")

    if (cached && cached.headSha === headSha && this.now() - cached.fetchedAt < PR_GET_TTL_MS) {
      return cached.view
    }

    const filesRes = await this.fetch(`${baseUrl}/files?per_page=300`)
    if (!filesRes.ok) throw await this.toError(filesRes)
    const files = (await filesRes.json()) as unknown[]

    const view = PrViewSchema.parse({
      number: args.number,
      state: detail.merged_at ? "merged" : (detail.state as string),
      title: String(detail.title ?? ""),
      headSha,
      baseSha: String((detail.base as { sha?: string } | undefined)?.sha ?? ""),
      author: String((detail.user as { login?: string } | undefined)?.login ?? ""),
      files: files.map((f) => mapFile(f as Record<string, unknown>)),
      truncated: files.length >= 300,
    })

    this.cache.set(cacheKey, { view, fetchedAt: this.now(), headSha })
    codaBus.emit("Pr.Fetched", { number: args.number, headSha })
    return view
  }

  async review(args: ReviewArgs): Promise<void> {
    const view = await this.get({ owner: args.owner, repo: args.repo, number: args.number })

    if (args.kind === "APPROVE") {
      if (view.state !== "open") {
        throw {
          code: "pr_closed",
          message: `Cannot review a ${view.state} PR`,
          retryable: false,
        } satisfies GitHubError
      }
      if (this.opts.currentUser && view.author === this.opts.currentUser) {
        throw {
          code: "self_approval",
          message: "Cannot approve your own PR",
          retryable: false,
        } satisfies GitHubError
      }
    }

    const url = `${this.baseUrl}/repos/${args.owner}/${args.repo}/pulls/${args.number}/reviews`
    const res = await this.fetch(url, {
      method: "POST",
      body: JSON.stringify({ event: args.kind, body: args.body ?? "" }),
    })
    if (!res.ok)
      throw await this.toError(
        res,
        args.kind === "APPROVE"
          ? "approve"
          : args.kind === "COMMENT"
            ? "comment"
            : "request_changes",
      )
  }

  invalidateCache(): void {
    this.cache.clear()
  }

  cacheSize(): number {
    return this.cache.size
  }

  private fetch(url: string, init?: Parameters<FetchLike>[1]): ReturnType<FetchLike> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    }
    if (this.opts.token) headers.Authorization = `token ${this.opts.token}`
    if (init?.body) headers["Content-Type"] = "application/json"
    return this.opts.fetch(url, { ...init, headers })
  }

  private async toError(
    res: Awaited<ReturnType<FetchLike>>,
    reviewKind?: "approve" | "comment" | "request_changes",
  ): Promise<GitHubError> {
    let body: { message?: string } | undefined
    try {
      body = (await res.json()) as { message?: string }
    } catch {
      body = undefined
    }
    return classifyGitHubError({
      status: res.status,
      body,
      headers: {
        "x-ratelimit-remaining": res.headers.get("x-ratelimit-remaining") ?? undefined,
        "x-ratelimit-reset": res.headers.get("x-ratelimit-reset") ?? undefined,
      },
      reviewKind,
    })
  }
}

const ListItemSchema = z.object({
  number: z.number(),
  state: z.string(),
  title: z.string(),
  user: z.object({ login: z.string() }),
  head: z.object({ sha: z.string() }),
  base: z.object({ sha: z.string() }),
  merged_at: z.string().nullable().optional(),
})

function mapListItem(raw: Record<string, unknown>): PrView {
  const parsed = ListItemSchema.parse(raw)
  const state = parsed.merged_at ? "merged" : (parsed.state as "open" | "closed" | "merged")
  return PrViewSchema.parse({
    number: parsed.number,
    state,
    title: parsed.title,
    headSha: parsed.head.sha,
    baseSha: parsed.base.sha,
    author: parsed.user.login,
    files: [],
  })
}

function mapFile(raw: Record<string, unknown>): PrFile {
  const status = String(raw.status) as PrFile["status"]
  const additions = Number(raw.additions ?? 0)
  const deletions = Number(raw.deletions ?? 0)
  const patch = typeof raw.patch === "string" ? raw.patch : null
  const blobUrl = typeof raw.blob_url === "string" ? raw.blob_url : undefined
  return {
    path: String(raw.filename ?? raw.path ?? ""),
    status,
    additions,
    deletions,
    patch,
    ...(blobUrl !== undefined && { blobUrl }),
  }
}
