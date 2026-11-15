/**
 * Mock-mode session, kept in sessionStorage so it survives the full-page redirects of the
 * sign-in flow but not a closed tab. Stands in for the backend's httpOnly cookie.
 */
import { apiFetch } from '@/api/client'
import user from './fixtures/user.json'

const KEY = 'fof.mockSession'

/** Mock only: the dev stand-in for the provider step posts here. Not part of the contract. */
export const DEV_SIGN_IN_PATH = '/api/v1/auth/dev/sign-in'

export type MockUser = typeof user

export function readMockSession(): MockUser | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as MockUser) : null
  } catch {
    return null
  }
}

export function writeMockSession(email?: string): MockUser {
  const u = { ...user, email: email?.trim() || user.email }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(u))
  } catch {
    /* storage blocked: the session lasts until reload */
  }
  return u
}

export function clearMockSession() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Called by the dev sign-in page. Goes through MSW like any request. */
export async function devSignIn(email?: string): Promise<void> {
  await apiFetch(DEV_SIGN_IN_PATH, { body: { email } })
}

export const DEV_USER_EMAIL = user.email
