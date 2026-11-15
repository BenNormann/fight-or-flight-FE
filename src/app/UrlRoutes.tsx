import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router'
import type { Selection } from '@/domain'
import { useAppStore } from '@/state/store'
import { pathFor } from './urlSync'

const sameSelection = (a: Selection | null, b: Selection) => a?.kind === b.kind && a.id === b.id

/** URL → store, one element per route in router.tsx. */
export function SelectFromUrl({ kind }: { kind: 'building' | 'room' }) {
  const params = useParams()
  const id = kind === 'building' ? params.buildingId : params.roomId
  useEffect(() => {
    if (!id) return
    const s = useAppStore.getState()
    if (!(s.view === 'place' && sameSelection(s.selection, { kind, id }))) s.select({ kind, id })
  }, [id, kind])
  return null
}

export function DirectionsFromUrl() {
  const [params] = useSearchParams()
  const to = params.get('to')
  const from = params.get('from')
  useEffect(() => {
    const s = useAppStore.getState()
    if (s.view !== 'directions' || s.destination !== to) s.directionsTo(to)
    if (useAppStore.getState().origin !== from) useAppStore.getState().setTripEnd('origin', from)
  }, [to, from])
  return null
}

/** `/`: leaving a deep-linked state (browser back) returns the store to its sheet state. */
export function HomeFromUrl() {
  useEffect(() => {
    const s = useAppStore.getState()
    if (pathFor(s) !== '/') s.select(null)
  }, [])
  return null
}
