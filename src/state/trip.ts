/**
 * The trip being planned or travelled: both ends resolved to places, and the routes
 * between them. One hook for the directions view, the map and the navigation driver,
 * so they always agree. Routes come from the backend planner when it is served
 * (`routing` capability), otherwise from the demo set.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useCapability } from '@/api/capabilities'
import { recallPlace, routeErrorMessage, usePlace, usePointName, useRoutes } from '@/api/queries'
// DEMO: place names and sample routes until the backend serves places (docs/BACKEND_CONTRACT.md).
import { ORIGIN, demoRoutes, placeOf } from '@/demo'
import type { Id, LngLat, Route } from '@/domain'
import { env } from '@/lib/env'
import { useUserLocation } from '@/lib/geo/location'
import { distanceM } from '@/lib/nav/geo'
import { parsePin } from '@/lib/pin'
import { useAppStore, type TravelMode } from './store'

export interface TripPlace {
  /** null: the user's own location. */
  id: Id | null
  name: string
  lngLat: LngLat
}

/**
 * `incomplete`: an end is not chosen. `needs-location`: the start is "your location" and we do not have it.
 * `loading` / `error`: the planner. `ready`: `routes` holds at least one route.
 */
export type TripStatus = 'incomplete' | 'needs-location' | 'loading' | 'error' | 'ready'

export interface Trip {
  from: TripPlace | null
  to: TripPlace | null
  routes: Route[]
  status: TripStatus
  /** Why planning failed, for the user. */
  message?: string
  /** Straight-line distance between the two ends. */
  crowFliesM: number | null
  /** Routes are from the backend planner (not sample data). */
  live: boolean
  retry: () => void
}

export const YOUR_LOCATION = 'Your location'

/** Pace per mode. The planner returns one walking line; other modes only change the time. */
const SPEED_MPS: Record<TravelMode, number> = { walk: 1.35, bike: 4.6, ride: 7.5 }
const RIDE_WAIT_S = 240
/** "Your location" as a start is re-planned only after moving this far, and never during a started route. */
const REPLAN_AFTER_M = 40
/** The planner works within the study area; a start far outside it is not usable. */
const MAX_FROM_CENTER_M = 20_000

const retimed = (routes: Route[], mode: TravelMode): Route[] =>
  mode === 'walk' ? routes : routes.map((r) => ({ ...r, durationS: Math.round(r.distanceM / SPEED_MPS[mode] + (mode === 'ride' ? RIDE_WAIT_S : 0)) }))

/** The user's position as a trip start: the device's when we have it nearby, the demo gate in mock mode. */
export function useMyPosition(): LngLat | null {
  const { fix } = useUserLocation()
  const here = fix && distanceM(fix.lngLat, ORIGIN) <= MAX_FROM_CENTER_M ? fix.lngLat : null
  return here ?? (env.useMocks ? ORIGIN : null)
}

/**
 * One end of a trip as a place. Demo ids and pins resolve at once; a backend place comes from
 * what search already returned, or is fetched (a shared link opened cold). A pin gets a real
 * name from the backend when it has one for that point.
 */
function useTripPlace(id: Id | null): TripPlace | null {
  const served = useCapability('search') && !env.useMocks
  const pin = parsePin(id)
  const local = placeOf(id)
  const pinName = usePointName(pin, served)
  const seen = recallPlace(id)
  const fetched = usePlace(id && !local && !seen ? id : null, served).data
  return useMemo(() => {
    if (!id) return null
    if (pin) return { id, name: pinName ?? 'Dropped pin', lngLat: pin }
    if (local) return local
    const place = fetched ?? seen
    return place ? { id, name: place.name, lngLat: place.lngLat } : null
    // `pin` is derived from `id`; its identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, pinName, local?.id, fetched, seen])
}

let anchorAt: LngLat | null = null
const anchorListeners = new Set<() => void>()
const subscribeAnchor = (l: () => void) => {
  anchorListeners.add(l)
  return () => anchorListeners.delete(l)
}

export function useTrip(): Trip {
  const origin = useAppStore((s) => s.origin)
  const destination = useAppStore((s) => s.destination)
  const travelMode = useAppStore((s) => s.travelMode)
  const leaveAt = useAppStore((s) => s.leaveAt)
  const started = useAppStore((s) => s.activeRouteId !== null)
  const live = useCapability('routing') && !env.useMocks
  const me = useMyPosition()

  // Hold the start still while the user walks: every GPS fix would otherwise plan a new route.
  // Shared by every caller of this hook, so the map and the views always plan from the same point.
  const anchor = useSyncExternalStore(subscribeAnchor, () => anchorAt, () => anchorAt) ?? me
  useEffect(() => {
    if (!me || started) return
    if (anchorAt && distanceM(anchorAt, me) < REPLAN_AFTER_M) return
    anchorAt = me
    anchorListeners.forEach((l) => l())
  }, [me, started])

  const originPlace = useTripPlace(origin)
  const from = useMemo<TripPlace | null>(() => {
    if (origin === null) return anchor ? { id: null, name: YOUR_LOCATION, lngLat: anchor } : null
    return originPlace
  }, [origin, anchor, originPlace])
  const to = useTripPlace(destination)

  const request = useMemo(() => (live && from && to ? { from: from.lngLat, to: to.lngLat, ...(leaveAt ? { at: leaveAt } : {}) } : null), [live, from, to, leaveAt])
  const planned = useRoutes(request, live)

  const demo = useMemo(() => (live || !from || !to ? [] : demoRoutes(to.id, travelMode, from.lngLat, to.lngLat)), [live, from, to, travelMode])
  const liveRoutes = useMemo(() => retimed(planned.data ?? [], travelMode), [planned.data, travelMode])
  const routes = live ? liveRoutes : demo

  const status: TripStatus = !to
    ? 'incomplete'
    : !from
      ? origin === null
        ? 'needs-location'
        : 'incomplete'
      : !live
        ? 'ready'
        : planned.isError
          ? 'error'
          : planned.data?.length
            ? 'ready'
            : 'loading'

  return {
    from,
    to,
    routes: status === 'ready' ? routes : [],
    status,
    message: status === 'error' ? routeErrorMessage(planned.error) : undefined,
    crowFliesM: from && to ? distanceM(from.lngLat, to.lngLat) : null,
    live,
    retry: () => void planned.refetch(),
  }
}
