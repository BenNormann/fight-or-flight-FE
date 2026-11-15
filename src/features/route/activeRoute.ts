import { useMemo } from 'react'
import type { Route } from '@/domain'
import { useAppStore } from '@/state/store'
import { useTrip } from '@/state/trip'

export interface ActiveTrip {
  route: Route
  destinationName: string
}

/** The started route and where it goes, or null. One lookup for the banner, trip bar, steps and the driver. */
export function useActiveTrip(): ActiveTrip | null {
  const activeRouteId = useAppStore((s) => s.activeRouteId)
  const { routes, to } = useTrip()
  return useMemo(() => {
    if (!activeRouteId) return null
    const route = routes.find((r) => r.id === activeRouteId)
    return route && to ? { route, destinationName: to.name } : null
  }, [activeRouteId, routes, to])
}
