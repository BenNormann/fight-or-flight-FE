import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useDemoIncidents } from '@/api/queries'
import type { LngLat, SimulatedIncident } from '@/domain'
import { demoMode } from '@/lib/demoMode'
import { getLocation } from '@/lib/geo/location'
import { bearingDeg, distanceM } from '@/lib/nav'
import { useAppStore } from '@/state/store'
import { rerouteFrom } from '@/state/trip'
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
  const client = useQueryClient()
  const seen = useRef<Set<string> | null>(null)

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
    // Re-plan from where the traveller is (state/trip.ts keeps the current route until the new one arrives).
    const rerouting =
      activeRouteId !== null &&
      nav !== null &&
      !nav.arrived &&
      rerouteFrom(nav.position, (outcome) => {
        if (!outcome.ok) {
          notify({ id: 'demo-incident', title: 'Could not find a way around it', description: outcome.message })
          return
        }
        // Follow the safest plan (when the planner sends one route, the trip follows that one anyway).
        const { activeRouteId: now, startRoute } = useAppStore.getState()
        if (now !== SAFEST_ID) startRoute(SAFEST_ID)
        notify({ id: 'demo-incident', title: 'Rerouted around the incident', description: 'The walk continues on the new route.' })
      })
    // Not walking: plan the routes on screen again, so they go around it too.
    if (!rerouting) void client.invalidateQueries({ queryKey: ['routes'] })
    notify({
      id: 'demo-incident',
      politeness: 'alert',
      title: `${latest.category} reported ${where}`,
      description: rerouting ? 'Finding a route around it…' : 'Routes planned now will avoid it.',
    })
    // `client` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
}
