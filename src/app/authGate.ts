/**
 * The sign-in gate. Every way into directions (FAB, a place's Directions action, a `/route` link)
 * ends at a `/route` URL via the store → URL sync, so gating that one path covers them all.
 */
import { LOGIN_ROUTE } from '@/api/adapters/auth'
import type { SessionStatus } from '@/api/queries'

export type Gate = 'allow' | 'wait' | 'login'

export const requiresSignIn = (path: string) => path === '/route' || path.startsWith('/route?')

export const isLoginPath = (pathname: string) => pathname === LOGIN_ROUTE || pathname.startsWith(`${LOGIN_ROUTE}/`)

/** `off` (backend serves no auth) never gates: hiding directions would hide a served feature. */
export function gateFor(path: string, status: SessionStatus): Gate {
  if (!requiresSignIn(path)) return 'allow'
  if (status === 'pending') return 'wait'
  return status === 'signedOut' ? 'login' : 'allow'
}
