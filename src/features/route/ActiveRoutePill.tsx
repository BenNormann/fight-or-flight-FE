import { NavigationArrowIcon, XIcon } from '@phosphor-icons/react'
import { demoRoutes, placeOf } from '@/demo'
import { useAppStore } from '@/state/store'
import { StatusPill, arrivalTime, formatClock, formatDistance, formatDuration } from '@/ui'

/** Shown while a route is active, on top of the map. */
export default function ActiveRoutePill() {
  const activeRouteId = useAppStore((s) => s.activeRouteId)
  const destination = useAppStore((s) => s.destination)
  const travelMode = useAppStore((s) => s.travelMode)
  const leaveAt = useAppStore((s) => s.leaveAt)
  const endRoute = useAppStore((s) => s.endRoute)
  const route = demoRoutes(destination, travelMode).find((r) => r.id === activeRouteId)
  const to = placeOf(destination)
  if (!route || !to) return null

  return (
    <StatusPill
      label="Active route"
      icon={<NavigationArrowIcon weight="fill" />}
      summary={
        <>
          <span className="font-mono">{formatDuration(route.durationS)}</span> · {to.name}
        </>
      }
      detail={
        <>
          {route.kind === 'safest' ? 'Safest' : 'Fastest'} route · {formatDistance(route.distanceM)} · arrive{' '}
          {formatClock(arrivalTime(route.durationS, leaveAt))}
          <br />
          Head north on Trousdale Parkway, then turn right at Hahn Plaza.
        </>
      }
      action={
        <button
          type="button"
          onClick={endRoute}
          aria-label="End route"
          className="button-sm inline-flex h-tap items-center gap-1 rounded-full bg-primary-foreground/10 px-3 outline-none hover:bg-primary-foreground/20 focus-visible:ring-2 focus-visible:ring-primary-foreground"
        >
          <XIcon aria-hidden className="size-4" /> End
        </button>
      }
    />
  )
}
