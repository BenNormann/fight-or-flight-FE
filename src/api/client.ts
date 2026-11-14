import { env } from '@/lib/env'

export class ApiError extends Error {
  readonly status: number
  readonly path: string
  constructor(status: number, path: string, message?: string) {
    super(message ?? `API ${status} for ${path}`)
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

/** Returns unvalidated JSON. Adapters must parse it with Zod before it goes anywhere. */
export async function apiFetch(
  path: string,
  opts: { query?: Query; body?: unknown; signal?: AbortSignal } = {},
): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(url(path, opts.query), {
      method: opts.body === undefined ? 'GET' : 'POST',
      headers: opts.body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new ApiError(0, path, `Network error for ${path}`)
  }
  if (!res.ok) throw new ApiError(res.status, path)
  return res.json()
}
