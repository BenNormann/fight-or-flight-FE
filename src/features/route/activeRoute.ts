import { useMemo } from 'react'
import { demoRoutes, placeOf } from '@/demo'
import type { Route } from '@/domain'
import { useAppStore } from '@/state/store'

export interface ActiveTrip {
  route: Route
  destinationName: string
}

/** The started route and where it goes, or null. One lookup for the banner, trip bar, steps and the driver. */
export function useActiveTrip(): ActiveTrip | null {
  const activeRouteId = useAppStore((s) => s.activeRouteId)
  const destination = useAppStore((s) => s.destination)
  const travelMode = useAppStore((s) => s.travelMode)
  return useMemo(() => {
    if (!activeRouteId) return null
    const route = demoRoutes(destination, travelMode).find((r) => r.id === activeRouteId)
    const to = placeOf(destination)
    return route && to ? { route, destinationName: to.name } : null
  }, [activeRouteId, destination, travelMode])
}
