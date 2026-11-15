/**
 * Search as the views and the map see it: the current query and category, and the results,
 * from the backend when it serves search and has places loaded, otherwise from the demo set.
 * One hook, so the result list and the pins on the map always agree.
 */
import { useEffect, useMemo, useState } from 'react'
import { recallPlace, useLiveSearch, usePlace, usePlaceCategories, usePlaceSearch, usePlacesInCells } from '@/api/queries'
// DEMO: sample places while the backend has none (docs/BACKEND_CONTRACT.md).
import { CAMPUS_CENTER, CATEGORIES, demoSearch } from '@/demo'
import type { BBox, Place, SearchResult } from '@/domain'
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
const CHIP_ORDER = ['campus', 'food', 'cafe', 'study', 'parking', 'grocery', 'fitness'] as const
/** The backend's labels are written for a list ("Study Spots & Libraries"); a chip needs one word. */
const CHIP_LABEL: Record<string, string> = { campus: 'Buildings', food: 'Food', cafe: 'Cafes', study: 'Study', parking: 'Parking', grocery: 'Grocery', fitness: 'Fitness' }
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
      return c ? [{ id: c.id, label: CHIP_LABEL[c.id] ?? c.label }] : []
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
      // Also while a new query is in flight with nothing to show yet: "no matches" must not flash before the answer.
      loading: !idle && (found.isPending || settled !== query || (found.isFetching && !places.length)),
      live,
      failed: !idle && found.isError,
    }
  }, [live, query, category, categoryLabel, settled, found.data, found.isPending, found.isFetching, found.isError])
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

/** Each cell is split into this many blocks a side, and the best-known places are kept per block: even cover, no bare patches. */
const BLOCKS = 2
const PER_BLOCK = 4
/** Zoomed out: labels kept per (large) cell. */
const WIDE_PER_CELL = 2
/** Campus buildings have no reviews; on a campus map they still outrank a small shop. */
const BUILDING_RANK = 400
/** Campus buildings and libraries are asked for apart from businesses: there are too many of each for one answer. */
const CAMPUS_GROUP = ['campus', 'study']
/** Left out of the map labels: the catch-all, and transit stops (the basemap draws those). */
const UNLABELLED = new Set(['other', 'transit'])
/** Furniture, not places: hundreds of bike racks and single study rooms would bury the buildings. */
const isClutter = (p: Place) => !!p.subcategory && (p.subcategory.startsWith('bike') || p.subcategory === 'study_spot')

/** How well known a place is, for choosing which labels to show first. */
export const placeRank = (p: Place) => Math.max(p.reviewCount ?? 0, p.kind === 'building' ? BUILDING_RANK : 0)

/** The best-known places of one cell, a few from each of its blocks. */
export function pickEvenly(places: Place[], [w, s, e, n]: BBox, blocks = BLOCKS, perBlock = PER_BLOCK): Place[] {
  const buckets = new Map<number, Place[]>()
  for (const p of places) {
    if (isClutter(p)) continue
    const bx = Math.min(blocks - 1, Math.max(0, Math.floor(((p.lngLat[0] - w) / (e - w)) * blocks)))
    const by = Math.min(blocks - 1, Math.max(0, Math.floor(((p.lngLat[1] - s) / (n - s)) * blocks)))
    const key = by * blocks + bx
    buckets.set(key, [...(buckets.get(key) ?? []), p])
  }
  return [...buckets.values()].flatMap((b) => b.sort((x, y) => placeRank(y) - placeRank(x)).slice(0, perBlock))
}

/**
 * Places to label on the map: the best-known few in every block of every visible cell, so the
 * whole view is covered instead of one cluster. Empty unless search is live. Stable while cells load.
 */
/**
 * `blocks`: how finely each cell is divided when choosing labels. 0 = zoomed out (large cells, a couple
 * of places each); 2, 4, 8 = closer and closer in, until every place in view has a label.
 */
export function useAmbientPlaces(cells: BBox[], blocks = BLOCKS): Place[] {
  const detailed = blocks > 0
  const { data: categories } = usePlaceCategories()
  const groups = useMemo(() => {
    const ids = (categories ?? []).map((c) => c.id).filter((id) => !UNLABELLED.has(id))
    const campus = ids.filter((id) => CAMPUS_GROUP.includes(id))
    const rest = ids.filter((id) => !CAMPUS_GROUP.includes(id) && id !== 'parking')
    // Parking apart too: around campus it is mostly bike racks, which would crowd out the car parks.
    // Zoomed out, a cell is a neighbourhood: one request for everything but parking, and only its best-known places show.
    if (!detailed) return [ids.filter((id) => id !== 'parking').join(',')].filter(Boolean)
    return [campus, rest, ids.filter((id) => id === 'parking')].filter((g) => g.length).map((g) => g.join(','))
  }, [categories, detailed])
  const perCell = usePlacesInCells(groups.length ? cells : NO_CELLS, groups)
  return useMemo(() => {
    const seen = new Set<string>()
    return perCell.flatMap((places, i) => (detailed ? pickEvenly(places, cells[i]!, blocks) : pickEvenly(places, cells[i]!, 1, WIDE_PER_CELL)).filter((p) => !seen.has(p.id) && seen.add(p.id)))
    // `cells` and `perCell` change together.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perCell, blocks])
}
const NO_CELLS: BBox[] = []

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
