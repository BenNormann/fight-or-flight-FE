/**
 * Search as the views and the map see it: the current query and category, and the results,
 * from the backend when it serves search and has places loaded, otherwise from the demo set.
 * One hook, so the result list and the pins on the map always agree.
 */
import { useEffect, useMemo, useState } from 'react'
import { recallPlace, useLiveSearch, usePlace, usePlaceCategories, usePlaceSearch } from '@/api/queries'
// DEMO: sample places while the backend has none (docs/BACKEND_CONTRACT.md).
import { CAMPUS_CENTER, CATEGORIES, demoSearch } from '@/demo'
import type { Place, SearchResult } from '@/domain'
import { distanceText } from '@/lib/units'
import { useAppStore } from './store'
import { useMyPosition } from './trip'

/** Typing settles for this long before a request goes out. */
const SEARCH_DEBOUNCE_MS = 180

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return settled
}

export interface CategoryChip {
  id: string
  label: string
  /** Opens its own view instead of filtering search. */
  view?: 'events' | 'safety'
}

/** Backend categories worth a chip, in this order; the rest are reachable by typing. */
const CHIP_ORDER = ['food', 'cafe', 'study', 'parking', 'grocery', 'fitness'] as const
const VIEW_CHIPS: CategoryChip[] = [
  { id: 'events', label: 'Events', view: 'events' },
  { id: 'safety', label: 'Safety', view: 'safety' },
]

/** The category chips: the backend's categories when search is live, the demo ones otherwise. */
export function useCategoryChips(): CategoryChip[] {
  const { data } = usePlaceCategories()
  return useMemo(() => {
    if (!data?.length) return CATEGORIES.map((c) => (c.id === 'events' || c.id === 'safety' ? { ...c, view: c.id } : { ...c }))
    const served = CHIP_ORDER.flatMap((id) => {
      const c = data.find((x) => x.id === id)
      return c ? [{ id: c.id, label: c.label }] : []
    })
    return [...served, ...VIEW_CHIPS]
  }, [data])
}

const placeLine = (p: Place) => [p.subcategory?.replace(/_/g, ' '), p.address].filter(Boolean).join(' · ') || undefined

export const placeToResult = (p: Place): SearchResult => ({
  kind: 'place',
  id: p.id,
  label: p.name,
  sublabel: placeLine(p),
  meta: p.distanceM != null ? distanceText(p.distanceM) : undefined,
  lngLat: p.lngLat,
})

export interface SearchState {
  query: string
  category: string | null
  categoryLabel?: string
  results: SearchResult[]
  /** Backend places behind `results` (empty for demo results). */
  places: Place[]
  /** First results for this query are still on their way. */
  loading: boolean
  /** Results are from the backend. */
  live: boolean
  failed: boolean
}

export function useSearch(): SearchState {
  const query = useAppStore((s) => s.query)
  const category = useAppStore((s) => s.category)
  const live = useLiveSearch()
  const chips = useCategoryChips()
  const me = useMyPosition()
  const settled = useDebounced(query, SEARCH_DEBOUNCE_MS)
  const found = usePlaceSearch(settled, category, me ?? CAMPUS_CENTER, live)
  const categoryLabel = chips.find((c) => c.id === category)?.label

  return useMemo(() => {
    if (!live) return { query, category, categoryLabel, results: demoSearch(query, category), places: [], loading: false, live, failed: false }
    const idle = !query.trim() && !category
    const places = idle ? [] : (found.data ?? [])
    return {
      query,
      category,
      categoryLabel,
      results: places.map(placeToResult),
      places,
      loading: !idle && (found.isPending || settled !== query),
      live,
      failed: !idle && found.isError,
    }
  }, [live, query, category, categoryLabel, settled, found.data, found.isPending, found.isError])
}

/** Places to offer as a trip end for typed text: backend search when live, the demo set otherwise. */
export function useEndSearch(text: string): { results: SearchResult[]; loading: boolean } {
  const live = useLiveSearch()
  const me = useMyPosition()
  const settled = useDebounced(text, SEARCH_DEBOUNCE_MS)
  const found = usePlaceSearch(settled, null, me ?? CAMPUS_CENTER, live)
  return useMemo(() => {
    if (!live) return { results: demoSearch(text, null).filter((r) => r.lngLat && (r.kind === 'building' || r.kind === 'poi')), loading: false }
    if (!text.trim()) return { results: [], loading: false }
    return { results: (found.data ?? []).map(placeToResult), loading: found.isPending || settled !== text }
  }, [live, text, settled, found.data, found.isPending])
}

/** A backend place by id: what a search already returned, then the full detail. */
export function usePlaceById(id: string | null) {
  const detail = usePlace(id)
  return { place: detail.data ?? recallPlace(id), detail: detail.data, loading: detail.isPending && !!id, missing: detail.isError }
}

/** Backend places the map should pin: the search results while the search view is open, plus the selected place. */
export function useMapPlaces(): { places: Place[]; selected: Place | null; live: boolean } {
  const view = useAppStore((s) => s.view)
  const selection = useAppStore((s) => s.selection)
  const search = useSearch()
  const selectedId = selection?.kind === 'place' ? selection.id : null
  const { place } = usePlaceById(selectedId)
  return useMemo(() => {
    const selected = place ?? null
    const listed = view === 'search' || selectedId ? search.places : []
    const places = selected && !listed.some((p) => p.id === selected.id) ? [...listed, selected] : listed
    return { places, selected, live: search.live }
  }, [view, selectedId, place, search.places, search.live])
}
