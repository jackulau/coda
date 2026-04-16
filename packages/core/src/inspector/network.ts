export interface NetworkRequestRecord {
  id: string
  url: string
  method: string
  status?: number
  durationMs?: number
  reqBytes?: number
  resBytes?: number
  startedAt: number
  finishedAt?: number
  aborted?: boolean
  failed?: boolean
  pageIsHttps?: boolean
}

export type NetworkIssueKind =
  | "network-error"
  | `client-error-${number}`
  | `server-error-${number}`
  | "duplicate"
  | "mixed-content"
  | "aborted"

export interface NetworkIssue {
  kind: NetworkIssueKind
  requestId: string
  url: string
  detail?: string
}

export function classifyRequest(
  record: NetworkRequestRecord,
  history: NetworkRequestRecord[] = [],
): NetworkIssue[] {
  const out: NetworkIssue[] = []
  if (record.failed) out.push({ kind: "network-error", requestId: record.id, url: record.url })
  if (record.aborted) out.push({ kind: "aborted", requestId: record.id, url: record.url })
  if (record.status !== undefined) {
    if (record.status >= 400 && record.status < 500) {
      out.push({
        kind: `client-error-${record.status}` as NetworkIssueKind,
        requestId: record.id,
        url: record.url,
      })
    }
    if (record.status >= 500) {
      out.push({
        kind: `server-error-${record.status}` as NetworkIssueKind,
        requestId: record.id,
        url: record.url,
      })
    }
  }
  if (record.pageIsHttps && record.url.startsWith("http://")) {
    out.push({ kind: "mixed-content", requestId: record.id, url: record.url })
  }
  const dup = history.find(
    (h) =>
      h.url === record.url &&
      h.method === record.method &&
      Math.abs(record.startedAt - h.startedAt) < 1000 &&
      h.id !== record.id,
  )
  if (dup) {
    out.push({
      kind: "duplicate",
      requestId: record.id,
      url: record.url,
      detail: `dup-of:${dup.id}`,
    })
  }
  return out
}

export class BoundedRequestLog {
  private records: NetworkRequestRecord[] = []

  constructor(private readonly cap = 500) {}

  add(r: NetworkRequestRecord): void {
    this.records.push(r)
    if (this.records.length > this.cap) this.records.shift()
  }

  list(): NetworkRequestRecord[] {
    return [...this.records]
  }

  size(): number {
    return this.records.length
  }

  clear(): void {
    this.records = []
  }
}
