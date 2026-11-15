/**
 * All TanStack Query hooks and query keys. UI and map code get server data only from here,
 * always as domain types.
 */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import type { Id, LngLat, LocationFix, Place, RouteRequest, User } from '@/domain'
import { env } from '@/lib/env'
import { ApiError } from './client'
import { fetchMe, logout } from './adapters/auth'
import { fetchConfig } from './adapters/config'
import { postLocation } from './adapters/location'
import { fetchPlace, fetchPlaceCategories, reverseGeocode, searchPlaces } from './adapters/places'
import { fetchRoutes } from './adapters/route'

export { routeErrorMessage } from './adapters/route'
import { isUnavailable, markUnavailable, useCapabilities } from './capabilities'

export const queryKeys = {
  config: ['config'] as const,
  session: ['session'] as const,
  routes: (req: RouteRequest) => ['routes', req.from, req.to, req.at ?? 'now'] as const,
  placeCategories: ['places', 'categories'] as const,
  placeSearch: (q: string, category: string | null, near: LngLat | null) => ['places', 'search', q, category, near] as const,
  place: (id: Id) => ['places', 'detail', id] as const,
  reverse: (at: LngLat) => ['places', 'reverse', at] as const,
}

export function useAppConfig() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: ({ signal }) => fetchConfig(signal),
    staleTime: Infinity,
    retry: 1,
  })
}

/**
 * `pending`: config or `/me` still loading. `off`: the backend serves no auth (nothing is gated).
 * A failed `/me` (network) counts as signed out, so sign-in stays reachable.
 *
 * The real backend serves no config endpoint yet (docs/BACKEND_CONTRACT.md), so when config fails
 * `/me` itself is the probe: it answers 200/401 when auth is served, and a 404 turns auth off.
 */
export type SessionStatus = 'pending' | 'off' | 'signedOut' | 'signedIn'

export function useSession(): { status: SessionStatus; user: User | null } {
  const config = useAppConfig()
  const { auth: configured } = useCapabilities()
  const auth = configured || (config.isError && !isUnavailable('auth'))
  const me = useQuery({
    queryKey: queryKeys.session,
    queryFn: async ({ signal }) => {
      try {
        return await fetchMe(signal)
      } catch (e) {
        if (e instanceof ApiError && e.notServed) markUnavailable('auth')
        throw e
      }
    },
    enabled: auth,
    staleTime: 5 * 60_000,
    retry: false,
  })
  if (config.isPending) return { status: 'pending', user: null }
  if (!auth) return { status: 'off', user: null }
  if (me.isPending) return { status: 'pending', user: null }
  const user = me.data ?? null
  return { status: user ? 'signedIn' : 'signedOut', user }
}

export function useSignOut() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: logout,
    // Signed out locally even if the request failed: the UI must never claim a session it may not have.
    onSettled: () => client.setQueryData(queryKeys.session, null),
  })
}

/** Safe and fastest walking routes from the backend planner. `null` request or `enabled: false`: idle. */
export function useRoutes(req: RouteRequest | null, enabled = true) {
  return useQuery({
    queryKey: req ? queryKeys.routes(req) : ['routes', 'idle'],
    queryFn: async ({ signal }) => {
      try {
        return await fetchRoutes(req!, signal)
      } catch (e) {
        if (e instanceof ApiError && e.notServed) markUnavailable('routing')
        throw e
      }
    },
    enabled: enabled && !!req,
    // Risk changes by the hour, not by the minute.
    staleTime: 5 * 60_000,
    // A 400 is an answer (too far, off the street network): asking again will not change it.
    retry: (count, e) => count < 1 && !(e instanceof ApiError && e.status >= 400 && e.status < 500),
  })
}

// ── Places: search, categories, detail ───────────────────────────────────────

/** Places seen this session, by id: a search result can be shown or routed to before its detail loads. */
const seenPlaces = new Map<Id, Place>()
export const rememberPlaces = (places: Place[]) => places.forEach((p) => seenPlaces.set(p.id, p))
export const recallPlace = (id: Id | null | undefined) => (id ? seenPlaces.get(id) : undefined)

/** The backend's place categories. An empty list means the places table is not loaded. */
export function usePlaceCategories() {
  const served = useCapabilities().search && !env.useMocks
  return useQuery({
    queryKey: queryKeys.placeCategories,
    queryFn: async ({ signal }) => {
      try {
        return await fetchPlaceCategories(signal)
      } catch (e) {
        if (e instanceof ApiError && e.notServed) markUnavailable('search')
        throw e
      }
    },
    enabled: served,
    staleTime: 30 * 60_000,
    retry: 1,
  })
}

/**
 * Whether search runs on the backend: it serves search AND has places loaded.
 * `false` while that is still unknown, so the demo set covers the gap.
 */
export function useLiveSearch(): boolean {
  return (usePlaceCategories().data?.length ?? 0) > 0
}

/** Rounded so walking a few metres does not start a new search. About 100 m. */
const coarse = (p: LngLat | null): LngLat | null => (p ? [Math.round(p[0] * 1000) / 1000, Math.round(p[1] * 1000) / 1000] : null)

/** Backend place search. Idle (no request) until there is a query or a category. Keeps the last results while typing. */
export function usePlaceSearch(q: string, category: string | null, near: LngLat | null, enabled = true) {
  const text = q.trim()
  const at = coarse(near)
  const query = useQuery({
    queryKey: queryKeys.placeSearch(text, category, at),
    queryFn: async ({ signal }) => {
      const places = await searchPlaces({ q: text, category: category ?? undefined, near: at ?? undefined }, signal)
      rememberPlaces(places)
      return places
    },
    enabled: enabled && (!!text || !!category),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: 1,
  })
  return query
}

/** One place in full. A search result seen earlier shows at once while the detail loads. */
export function usePlace(id: Id | null, enabled = true) {
  return useQuery({
    queryKey: id ? queryKeys.place(id) : ['places', 'detail', 'idle'],
    queryFn: async ({ signal }) => {
      const place = await fetchPlace(id!, undefined, signal)
      rememberPlaces([place])
      return place
    },
    enabled: enabled && !!id,
    staleTime: 5 * 60_000,
    retry: (count, e) => count < 1 && !(e instanceof ApiError && e.status === 404),
  })
}

/** A name for a point picked on the map; null while loading or when nothing named is near. */
export function usePointName(at: LngLat | null, enabled = true): string | null {
  const { data } = useQuery({
    queryKey: at ? queryKeys.reverse(at) : ['places', 'reverse', 'idle'],
    queryFn: ({ signal }) => reverseGeocode(at!, signal),
    enabled: enabled && !!at,
    staleTime: Infinity,
    retry: false,
  })
  return data ?? null
}

/** Time between location posts while sharing (owner decision: 10 s; may drop to 5 s). */
export const LIVE_LOCATION_INTERVAL_MS = 10_000
/** Movement below this is GPS jitter, not a new position: the post is skipped. */
export const LIVE_LOCATION_MIN_MOVE_M = 10

/** Great-circle distance in metres (only to decide whether a fix is new; not routing). */
export function metresBetween([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Post the first fix; then at most one per interval, and only after a meaningful move. */
export function shouldPostFix(
  last: { at: number; lngLat: LngLat } | null,
  now: number,
  lngLat: LngLat,
  intervalMs = LIVE_LOCATION_INTERVAL_MS,
  minMoveM = LIVE_LOCATION_MIN_MOVE_M,
): boolean {
  if (!last) return true
  return now - last.at >= intervalMs && metresBetween(last.lngLat, lngLat) >= minMoveM
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}
const pageVisible = () => document.visibilityState !== 'hidden'

export function toFix(p: GeolocationPosition): LocationFix {
  const { longitude, latitude, accuracy, heading, speed } = p.coords
  return {
    lngLat: [longitude, latitude],
    accuracyM: accuracy,
    ...(heading != null && Number.isFinite(heading) ? { headingDeg: heading } : {}),
    ...(speed != null && Number.isFinite(speed) ? { speedMps: speed } : {}),
    at: new Date(p.timestamp).toISOString(),
  }
}

/**
 * Shares the device position while signed in, opted in (off by default) and `liveLocation`
 * is served, and only while the page is visible. Watches geolocation and posts throttled fixes;
 * sign-out, opt-out or hiding the page clears the watch. Returns whether it is active.
 */
export function useLiveLocation(optedIn: boolean): boolean {
  const client = useQueryClient()
  const { status } = useSession()
  const { liveLocation } = useCapabilities()
  const visible = useSyncExternalStore(subscribeVisibility, pageVisible, () => false)
  const active = status === 'signedIn' && optedIn && liveLocation && visible && typeof navigator !== 'undefined' && 'geolocation' in navigator

  useEffect(() => {
    if (!active) return
    let last: { at: number; lngLat: LngLat } | null = null
    let inFlight = false
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const fix = toFix(p)
        const now = Date.now()
        if (inFlight || !shouldPostFix(last, now, fix.lngLat)) return
        last = { at: now, lngLat: fix.lngLat }
        inFlight = true
        postLocation(fix)
          .catch((e: unknown) => {
            if (e instanceof ApiError && e.status === 401) void client.invalidateQueries({ queryKey: queryKeys.session })
            else if (e instanceof ApiError && e.notServed) markUnavailable('liveLocation')
          })
          .finally(() => {
            inFlight = false
          })
      },
      () => {
        /* Permission denied or unavailable: nothing to share. */
      },
      { enableHighAccuracy: true, maximumAge: LIVE_LOCATION_INTERVAL_MS },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [active, client])

  return active
}
