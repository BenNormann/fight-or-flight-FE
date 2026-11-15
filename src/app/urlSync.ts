import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { loginRoute } from '@/api/adapters/auth'
import { useSession } from '@/api/queries'
import { useAppStore, type AppState } from '@/state/store'
import { gateFor, isLoginPath, requiresSignIn } from './authGate'

/** The URL a store state should live at. Everything not listed is `/` (a sheet state). */
export function pathFor(s: Pick<AppState, 'selection' | 'view' | 'destination'> & { origin?: AppState['origin'] }): string {
  if (s.view === 'directions') {
    const q = new URLSearchParams()
    if (s.destination) q.set('to', s.destination)
    // No `from`: the trip starts at the user's own location.
    if (s.origin) q.set('from', s.origin)
    const qs = q.toString()
    return qs ? `/route?${qs}` : '/route'
  }
  if (s.view === 'place' && s.selection?.kind === 'building') return `/b/${encodeURIComponent(s.selection.id)}`
  if (s.view === 'place' && s.selection?.kind === 'room') return `/r/${encodeURIComponent(s.selection.id)}`
  return '/'
}

/**
 * Store → URL. Reads the store at effect time (not the render snapshot) so a
 * deep link that the route element just applied is never overwritten.
 * A gated path (directions) goes to `/login?next=…` while signed out; the login pages own the URL.
 */
export function useStoreToUrl() {
  const navigate = useNavigate()
  const location = useLocation()
  const { status } = useSession()
  const selection = useAppStore((s) => s.selection)
  const view = useAppStore((s) => s.view)
  const destination = useAppStore((s) => s.destination)
  const origin = useAppStore((s) => s.origin)
  useEffect(() => {
    if (isLoginPath(location.pathname)) return
    const next = pathFor(useAppStore.getState())
    const gate = gateFor(next, status)
    if (gate === 'wait') return
    const here = location.pathname + location.search
    if (gate === 'login') {
      // A `/route` deep link is replaced, so back from the login page never lands on the gate again.
      navigate(loginRoute(next), { replace: requiresSignIn(here) })
      return
    }
    if (next !== here) navigate(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to store and session changes only
  }, [selection, view, destination, origin, status])
}
