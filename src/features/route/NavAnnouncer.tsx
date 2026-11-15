import { useAppStore } from '@/state/store'
import { useActiveTrip } from './activeRoute'
import { announcementFor } from './navModel'

/**
 * Polite live region for turn by turn. Its text changes once per new maneuver
 * (and on arrival), never on distance updates. Always mounted, so the region
 * exists before its first message.
 */
export default function NavAnnouncer() {
  const trip = useActiveTrip()
  const stepIndex = useAppStore((s) => s.nav?.stepIndex)
  const arrived = useAppStore((s) => s.nav?.arrived ?? false)
  const message = trip && stepIndex !== undefined ? announcementFor(trip, stepIndex, arrived) : ''

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="nav-announcer">
      {message}
    </div>
  )
}
