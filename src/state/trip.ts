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
import type { Id, IsoTime, LngLat, Route } from '@/domain'
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
/** "Your location" as a start is re-planned only after moving this far, and during a started route only by `rerouteFrom`. */
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

const NO_ROUTES: Route[] = []

let anchorAt: LngLat | null = null
const anchorListeners = new Set<() => void>()
const subscribeAnchor = (l: () => void) => {
  anchorListeners.add(l)
  return () => anchorListeners.delete(l)
}
const anchorChanged = () => anchorListeners.forEach((l) => l())

/** How a re-plan ended: `ok` with the new route in place, or not (the route being followed stays). */
export type RerouteOutcome = { ok: true } | { ok: false; message: string }

/** A re-plan of the started trip from where the user is, waiting on the planner. `prev*` is what it replaces. */
interface PendingReroute {
  prevFrom: LngLat
  prevAt: IsoTime | null
  onDone?: (outcome: RerouteOutcome) => void
}
let reroute: PendingReroute | null = null
const getReroute = () => reroute

/** A re-plan is waiting on the planner. */
export const isRerouting = () => reroute !== null

/**
 * The user left the started route: plan again from `at` (their position) to the same destination,
 * leaving now so risk is for the current hour. The started route stays on screen until the new one
 * arrives; if planning fails, it stays for good. Only for trips that start at "your location"
 * (a trip from a place is played through, not followed). Returns false when nothing was started.
 */
export function rerouteFrom(at: LngLat, onDone?: (outcome: RerouteOutcome) => void): boolean {
  const s = useAppStore.getState()
  if (s.activeRouteId === null || s.origin !== null || s.destination === null || reroute) return false
  reroute = { prevFrom: anchorAt ?? at, prevAt: s.leaveAt, onDone }
  anchorAt = at
  if (s.leaveAt) s.setLeaveAt(null)
  anchorChanged()
  return true
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
    anchorChanged()
  }, [me, started])

  const originPlace = useTripPlace(origin)
  const from = useMemo<TripPlace | null>(() => {
    if (origin === null) return anchor ? { id: null, name: YOUR_LOCATION, lngLat: anchor } : null
    return originPlace
  }, [origin, anchor, originPlace])
  const to = useTripPlace(destination)

  const request = useMemo(() => (live && from && to ? { from: from.lngLat, to: to.lngLat, ...(leaveAt ? { at: leaveAt } : {}) } : null), [live, from, to, leaveAt])
  const planned = useRoutes(request, live)

  // While a re-plan loads (or after it failed), keep the route being followed: it is still in the query cache.
  const pending = useSyncExternalStore(subscribeAnchor, getReroute, getReroute)
  const heldRequest = useMemo(
    () => (pending && request ? { from: pending.prevFrom, to: request.to, ...(pending.prevAt ? { at: pending.prevAt } : {}) } : null),
    [pending, request],
  )
  const held = useRoutes(heldRequest, live)
  useEffect(() => {
    // Every caller of this hook sees the same pending re-plan; the first to see it settle resolves it.
    if (!pending || reroute !== pending) return
    const finish = (outcome: RerouteOutcome | null) => {
      reroute = null
      anchorChanged()
      if (outcome) pending.onDone?.(outcome)
    }
    if (!started || origin !== null) return finish(null)
    if (!live || planned.isSuccess) return finish({ ok: true })
    if (planned.isError) {
      // Back to the start the followed route was planned from, so the trip shows that route again.
      anchorAt = pending.prevFrom
      if (pending.prevAt) useAppStore.getState().setLeaveAt(pending.prevAt)
      finish({ ok: false, message: routeErrorMessage(planned.error) })
    }
  }, [pending, started, origin, live, planned.isSuccess, planned.isError, planned.error])
  const plannedData = planned.data ?? (pending ? held.data : undefined)
  const plannedFailed = planned.isError && !pending

  const demo = useMemo(() => (live || !from || !to ? [] : demoRoutes(to.id, travelMode, from.lngLat, to.lngLat)), [live, from, to, travelMode])
  const liveRoutes = useMemo(() => retimed(plannedData ?? [], travelMode), [plannedData, travelMode])
  const routes = live ? liveRoutes : demo

  const status: TripStatus = !to
    ? 'incomplete'
    : !from
      ? origin === null
        ? 'needs-location'
        : 'incomplete'
      : !live
        ? 'ready'
        : plannedFailed
          ? 'error'
          : plannedData?.length
            ? 'ready'
            : 'loading'

  return {
    from,
    to,
    // The same empty list every time: a fresh one each render would look like new routes to the map.
    routes: status === 'ready' ? routes : NO_ROUTES,
    status,
    message: status === 'error' ? routeErrorMessage(planned.error) : undefined,
    crowFliesM: from && to ? distanceM(from.lngLat, to.lngLat) : null,
    live,
    retry: () => void planned.refetch(),
  }
}
