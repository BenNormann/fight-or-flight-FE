/**
 * Auth adapter (docs/BACKEND_CONTRACT.md "Auth"): Google sign-in on the backend, USC accounts only.
 * The session is an httpOnly cookie the FE never reads; it only asks `/me` who is signed in.
 * Paths live here once.
 */
import { z } from 'zod'
import { ApiError, apiFetch, apiUrl } from '@/api/client'
import type { User } from '@/domain'

export const AUTH_PATHS = {
  login: '/api/v1/auth/login',
  me: '/api/v1/auth/me',
  logout: '/api/v1/auth/logout',
} as const

/** The in-app route that starts sign-in. */
export const LOGIN_ROUTE = '/login'
/** Mock mode only: the development stand-in for the provider step. */
export const DEV_SIGN_IN_ROUTE = '/login/dev'

/** Owner decision: only USC accounts may sign in. The backend enforces it; the FE explains it. */
export const ALLOWED_EMAIL_DOMAIN = 'usc.edu'

export function isAllowedEmail(email: string): boolean {
  const m = /^[^\s@]+@([^\s@]+)$/.exec(email.trim().toLowerCase())
  return m?.[1] === ALLOWED_EMAIL_DOMAIN
}

/**
 * Readable message for `?error=` on `/login` (the backend redirects back with it when sign-in fails).
 * Unknown codes get a generic line; the raw code is never shown.
 */
export function loginErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  if (code === 'domain') return `Use your USC email (@${ALLOWED_EMAIL_DOMAIN}) to sign in. Other accounts are not allowed.`
  if (code === 'cancelled' || code === 'access_denied') return 'Sign in was cancelled. Try again when you are ready.'
  if (code === 'unavailable') return 'Sign in is not available right now. Try again later.'
  return 'Sign in did not finish. Try again.'
}

const backendUser = z.looseObject({
  id: z.union([z.string(), z.number()]),
  email: z.string().min(1),
  name: z.string().nullish(),
  picture: z.string().nullish(),
})

export function parseUser(raw: unknown): User {
  const u = backendUser.parse(raw)
  return {
    id: String(u.id),
    email: u.email,
    ...(u.name ? { name: u.name } : {}),
    ...(u.picture ? { picture: u.picture } : {}),
  }
}

/** Signed-in user, or `null` when signed out (401). Other failures throw. */
export async function fetchMe(signal?: AbortSignal): Promise<User | null> {
  try {
    return parseUser(await apiFetch(AUTH_PATHS.me, { signal }))
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null
    throw e
  }
}

export async function logout(): Promise<void> {
  await apiFetch(AUTH_PATHS.logout, { method: 'POST' })
}

/**
 * A same-origin path to return to after sign-in, or `/`. Rejects other origins,
 * protocol-relative and backslash tricks (the URL parser resolves them to another origin),
 * non-http schemes, and the login pages themselves (no loops).
 */
export function safeNext(raw: string | null | undefined, origin: string): string {
  if (!raw) return '/'
  let u: URL
  try {
    u = new URL(raw, origin)
  } catch {
    return '/'
  }
  if (u.origin !== origin) return '/'
  if (u.pathname === LOGIN_ROUTE || u.pathname.startsWith(`${LOGIN_ROUTE}/`)) return '/'
  return `${u.pathname}${u.search}${u.hash}`
}

/** `/login?next=…` for an in-app path. */
export function loginRoute(next: string): string {
  return `${LOGIN_ROUTE}?next=${encodeURIComponent(next)}`
}

/**
 * Where "Continue" sends the browser. Real: the backend's login endpoint with an absolute,
 * same-origin `next` (the backend must still allow-list it). Mock: the in-app dev stand-in.
 */
export function buildLoginUrl(next: string | null | undefined, origin: string, mock: boolean): string {
  const path = safeNext(next, origin)
  if (mock) return `${DEV_SIGN_IN_ROUTE}?next=${encodeURIComponent(path)}`
  return apiUrl(AUTH_PATHS.login, { next: `${origin}${path}` })
}
