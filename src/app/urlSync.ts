import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAppStore, type AppState } from '@/state/store'

/** The URL a store state should live at. Everything not listed is `/` (a sheet state). */
export function pathFor(s: Pick<AppState, 'selection' | 'view' | 'destination'>): string {
  if (s.view === 'directions') return s.destination ? `/route?to=${encodeURIComponent(s.destination)}` : '/route'
  if (s.view === 'place' && s.selection?.kind === 'building') return `/b/${encodeURIComponent(s.selection.id)}`
  if (s.view === 'place' && s.selection?.kind === 'room') return `/r/${encodeURIComponent(s.selection.id)}`
  return '/'
}

/**
 * Store → URL. Reads the store at effect time (not the render snapshot) so a
 * deep link that the route element just applied is never overwritten.
 */
export function useStoreToUrl() {
  const navigate = useNavigate()
  const location = useLocation()
  const selection = useAppStore((s) => s.selection)
  const view = useAppStore((s) => s.view)
  const destination = useAppStore((s) => s.destination)
  useEffect(() => {
    const next = pathFor(useAppStore.getState())
    if (next !== location.pathname + location.search) navigate(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to store changes only
  }, [selection, view, destination])
}
