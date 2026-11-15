import { env } from '@/lib/env'

export class ApiError extends Error {
  readonly status: number
  readonly path: string
  /** The backend's own explanation (`{ message }` in the error body), when it sent one. */
  readonly detail: string | undefined
  constructor(status: number, path: string, message?: string, detail?: string) {
    super(message ?? `API ${status} for ${path}`)
    this.detail = detail
    this.name = 'ApiError'
    this.status = status
    this.path = path
  }
  /** The backend does not serve this (yet). Capabilities treat it as "feature off". */
  get notServed() {
    return this.status === 404 || this.status === 405 || this.status === 501
  }
}

type Query = Record<string, string | number | boolean | undefined | null>

function url(path: string, query?: Query) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) if (v != null) qs.set(k, String(v))
  const s = qs.toString()
  return `${env.apiBase}${path}${s ? `?${s}` : ''}`
}

/** Absolute URL for a backend path, for full-page navigations (e.g. sign-in) rather than fetches. */
export function apiUrl(path: string, query?: Query) {
  return url(path, query)
}

/**
 * Returns unvalidated JSON (`null` for an empty body such as 204). Adapters must parse it with Zod
 * before it goes anywhere. Sends cookies: the session is an httpOnly cookie (docs/BACKEND_CONTRACT.md).
 */
export async function apiFetch(
  path: string,
  opts: { query?: Query; body?: unknown; method?: 'GET' | 'POST'; signal?: AbortSignal } = {},
): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url(path, opts.query), {
      method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
      headers: opts.body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      credentials: 'include',
      signal: opts.signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError(0, path, `Network error for ${path}`)
  }
  if (!res.ok) {
    let detail: string | undefined
    try {
      const body = (await res.json()) as { message?: unknown } | null
      if (typeof body?.message === 'string') detail = body.message
    } catch {
      /* No JSON body: the status is all we know. */
    }
    throw new ApiError(res.status, path, undefined, detail)
  }
  if (res.status === 204) return null
  const text = await res.text()
  return text ? (JSON.parse(text) as unknown) : null
}
