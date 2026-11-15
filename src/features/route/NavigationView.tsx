import { CheckIcon, CrosshairIcon, XIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'
import { formatTime } from '@/lib/time'
import { distanceText, durationText } from '@/lib/units'
import { followTraveller } from '@/map/controller'
import { useAppStore } from '@/state/store'
import { Button, IconButton, Section, ViewHeader, useBreakpoint } from '@/ui'
import { useActiveTrip, type ActiveTrip } from './activeRoute'
import { useNow } from './clock'
import { ManeuverIcon } from './ManeuverIcon'
import { instructionFor, navModel, type NavModel } from './navModel'

/** Arrival time, time and distance left, End (Done once arrived), and recenter while the camera is free. */
function TripBar({ m }: { m: NavModel }) {
  const endRoute = useAppStore((s) => s.endRoute)
  const following = useAppStore((s) => s.navFollowing)
  const aimFree = useAppStore((s) => s.navAimFree)
  const eta = new Date(useNow() + m.remainingS * 1000)

  return (
    <div data-testid="trip-bar" className="flex min-h-14 items-center gap-3 py-1">
      <div className="min-w-0 flex-1">
        {m.arrived ? (
          <p className="heading-6">Arrived</p>
        ) : (
          <>
            <p className="heading-6 font-mono text-brand-ink" data-testid="trip-eta">
              {formatTime(eta)}
              <span className="body-6 ml-2 font-sans text-muted-foreground">arrival</span>
            </p>
            <p className="body-6 text-muted-foreground">
              <span className="font-mono">{durationText(m.remainingS)}</span> · <span className="font-mono">{distanceText(m.remainingM)}</span>
            </p>
          </>
        )}
      </div>
      {(!following || aimFree) && !m.arrived ? (
        <IconButton
          tone="secondary"
          label="Recenter on you"
          icon={<CrosshairIcon />}
          data-testid="nav-recenter"
          onClick={followTraveller}
        />
      ) : null}
      <Button tone="primary" icon={m.arrived ? <CheckIcon /> : <XIcon />} onClick={endRoute} data-testid="end-route">
        {m.arrived ? 'Done' : 'End'}
      </Button>
    </div>
  )
}

function StepList({ trip, m }: { trip: ActiveTrip; m: NavModel }) {
  return (
    <ol className="grid gap-1" aria-label="Steps">
      {trip.route.steps.map((s, i) => {
        const current = !m.arrived && i === m.stepIndex
        const passed = m.arrived || i < m.stepIndex
        return (
          <li
            key={`${i}-${s.offsetM}`}
            aria-current={current ? 'step' : undefined}
            className={cn('-mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-2', current && 'bg-accent text-accent-foreground')}
          >
            <span
              aria-hidden
              className={cn('grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-5', current ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}
            >
              <ManeuverIcon maneuver={s.maneuver} weight={current ? 'fill' : 'regular'} />
            </span>
            <span className={cn('min-w-0 flex-1', passed && 'text-muted-foreground')}>
              <span className="title-3 block">{instructionFor(trip, s)}</span>
              {s.distanceM > 0 ? <span className="body-6 block font-mono text-muted-foreground">{distanceText(s.distanceM)}</span> : null}
            </span>
            {passed ? <span className="caption-4 shrink-0 text-muted-foreground">Done</span> : null}
          </li>
        )
      })}
    </ol>
  )
}

/** Sheet / panel content while a route is started. Phone: the trip bar is the peek; desktop: it sticks to the bottom. */
export default function NavigationView() {
  const trip = useActiveTrip()
  const nav = useAppStore((s) => s.nav)
  const desktop = useBreakpoint() === 'desktop'
  if (!trip) return null
  const m = navModel(trip, nav)
  const kind = trip.route.kind === 'safest' ? 'Safest route' : 'Fastest route'

  return (
    <div data-testid="view-navigation">
      {desktop ? null : <TripBar m={m} />}
      <div className={desktop ? undefined : 'mt-4'}>
        <ViewHeader eyebrow={kind} title={m.arrived ? 'You have arrived' : `To ${trip.destinationName}`} subtitle={m.arrived ? trip.destinationName : undefined} />
      </div>
      {trip.route.steps.length ? (
        <Section title="Steps">
          <StepList trip={trip} m={m} />
        </Section>
      ) : (
        <p className="body-6 text-muted-foreground">Turn by turn steps are not available for this route.</p>
      )}
      {desktop ? (
        <div className="sticky bottom-0 z-10 -mx-gutter mt-4 bg-card px-gutter pt-2 pb-4">
          <TripBar m={m} />
        </div>
      ) : null}
    </div>
  )
}
