import { useEffect, useRef } from 'react'
import { useDemoIncidents } from '@/api/queries'
import type { LngLat, SimulatedIncident } from '@/domain'
import { demoMode } from '@/lib/demoMode'
import { getLocation } from '@/lib/geo/location'
import { bearingDeg, distanceM } from '@/lib/nav'
import { useAppStore } from '@/state/store'
import { rerouteFrom, useTrip } from '@/state/trip'
import { notify } from '@/ui'

const SAFEST_ID = 'route-safest'

/** "140 m ahead" while walking toward it, "140 m behind you", or plain "140 m away". */
export function whereIs(incident: LngLat, from: LngLat, headingDeg?: number): string {
  const d = distanceM(from, incident)
  const m = d < 1000 ? `${Math.max(10, Math.round(d / 10) * 10)} m` : `${(d / 1000).toFixed(1)} km`
  if (headingDeg === undefined) return `${m} away`
  const off = Math.abs(((bearingDeg(from, incident) - headingDeg + 540) % 360) - 180)
  return off <= 60 ? `${m} ahead` : off >= 120 ? `${m} behind you` : `${m} away`
}

/**
 * Demo mode: announce each new simulated crime, and if a route is started, re-plan it from where the
 * traveller is so the backend's next route goes around the crime, then follow the safest route.
 * Crimes already active when the page loads are not announced.
 */
export function useDemoIncidentWatcher() {
  const { data } = useDemoIncidents()
  const trip = useTrip()
  const seen = useRef<Set<string> | null>(null)
  const awaitingReroute = useRef<{ routes: unknown } | null>(null)

  useEffect(() => {
    if (!demoMode || !data) return
    if (seen.current === null) {
      seen.current = new Set(data.map((i) => i.id))
      return
    }
    const fresh = data.filter((i) => !seen.current!.has(i.id))
    fresh.forEach((i) => seen.current!.add(i.id))
    const latest: SimulatedIncident | undefined = fresh[0]
    if (!latest) return

    const { nav, activeRouteId } = useAppStore.getState()
    const here = nav?.position ?? getLocation().fix?.lngLat
    const where = here ? whereIs(latest.lngLat, here, nav?.headingDeg) : 'nearby'
    const rerouting = activeRouteId !== null && nav !== null && !nav.arrived
    notify({
      id: 'demo-incident',
      politeness: 'alert',
      title: `${latest.category} reported ${where}`,
      description: rerouting ? 'Finding a route around it…' : 'Routes planned now will avoid it.',
    })
    if (rerouting) {
      awaitingReroute.current = { routes: trip.routes }
      rerouteFrom(nav.position)
    }
    // trip.routes is read only as the "before" snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  // The re-planned routes have arrived (a new list): follow the safest one.
  useEffect(() => {
    const pending = awaitingReroute.current
    if (!pending || trip.routes === pending.routes || trip.status !== 'ready') return
    awaitingReroute.current = null
    const safest = trip.routes.find((r) => r.id === SAFEST_ID) ?? trip.routes[0]
    if (!safest) return
    const { activeRouteId, startRoute } = useAppStore.getState()
    if (activeRouteId !== safest.id) startRoute(safest.id)
    notify({ id: 'demo-incident', title: 'Rerouted around the incident', description: `New route: ${Math.round(safest.distanceM)} m to go.` })
  }, [trip.routes, trip.status])
}
