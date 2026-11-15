import {
  ArrowsDownUpIcon,
  BicycleIcon,
  CarIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  NavigationArrowIcon,
  PersonSimpleWalkIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import { useRef } from 'react'
import { useCapability } from '@/api/capabilities'
import { buildings, demoRoutes, placeOf } from '@/demo'
import type { Route } from '@/domain'
import { cn } from '@/lib/cn'
import { riskBands } from '@/lib/risk'
import { formatTime } from '@/lib/time'
import { useAppStore, type TravelMode } from '@/state/store'
import {
  Button,
  Chip,
  ChipRow,
  ListRow,
  PlaceIcon,
  RiskBadge,
  Section,
  SegmentedControl,
  ViewHeader,
  arrivalTime,
  formatDistance,
  formatDuration,
  notify,
} from '@/ui'
import { LEAVE_OPTIONS, leaveIso, leaveOptionFor, rememberLeaveOption } from './leave'

const MODES = [
  { value: 'walk', label: <span className="inline-flex items-center gap-2"><PersonSimpleWalkIcon aria-hidden className="size-4" />Walk</span> },
  { value: 'bike', label: <span className="inline-flex items-center gap-2"><BicycleIcon aria-hidden className="size-4" />Bike</span> },
  { value: 'ride', label: <span className="inline-flex items-center gap-2"><CarIcon aria-hidden className="size-4" />Ride</span> },
] as const

function RouteCard({ route, selected, onSelect, leaveAt }: { route: Route; selected: boolean; onSelect: () => void; leaveAt: string | null }) {
  const title = route.kind === 'safest' ? 'Safest' : 'Fastest'
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      data-testid={`route-card-${route.kind}`}
      className={cn(
        'flex w-full flex-col gap-2 rounded-2xl border bg-card p-4 text-left transition-[transform,border-color] duration-200 active:scale-[0.98]',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-foreground ring-1 ring-foreground' : 'border-border hover:border-input',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="title-3 inline-flex items-center gap-2">
          {selected ? <CheckCircleIcon aria-hidden weight="fill" className="size-5" /> : null}
          {title}
        </span>
        <RiskBadge score={route.risk.mean} />
      </span>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="heading-5 font-mono">{formatDuration(route.durationS)}</span>
        <span className="body-6 text-muted-foreground">
          {formatDistance(route.distanceM)} · arrive {formatTime(arrivalTime(route.durationS, leaveAt))}
        </span>
      </span>
      {route.warnings.map((w) => (
        <span key={w} className="caption-4 flex items-start gap-2 text-muted-foreground">
          <WarningIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {w}
        </span>
      ))}
      {route.kind === 'safest' ? <span className="caption-4 text-muted-foreground">Stays on lit paths past emergency phones</span> : null}
    </button>
  )
}

/** What the coloured segments of the route line mean. Labels always shown. */
function RouteRiskLegend() {
  return (
    <div className="mt-3">
      <p className="caption-4 mb-1 text-muted-foreground" id="route-legend">
        Route line colours
      </p>
      <ul aria-labelledby="route-legend" className="flex flex-wrap gap-x-4 gap-y-1">
        {riskBands.map((b) => (
          <li key={b.level} className="caption-4 flex min-h-6 items-center gap-2">
            <span aria-hidden className="h-1 w-5 shrink-0 rounded-full" style={{ background: `var(${b.cssVar})` }} />
            {b.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function DirectionsView() {
  const destination = useAppStore((s) => s.destination)
  const directionsTo = useAppStore((s) => s.directionsTo)
  const travelMode = useAppStore((s) => s.travelMode)
  const setTravelMode = useAppStore((s) => s.setTravelMode)
  const routeKind = useAppStore((s) => s.routeKind)
  const setRouteKind = useAppStore((s) => s.setRouteKind)
  const leaveAt = useAppStore((s) => s.leaveAt)
  const setLeaveAt = useAppStore((s) => s.setLeaveAt)
  const startRoute = useAppStore((s) => s.startRoute)
  const back = useAppStore((s) => s.back)
  const liveRouting = useCapability('routing')
  const timeInput = useRef<HTMLInputElement>(null)

  const to = placeOf(destination)
  const routes = demoRoutes(destination, travelMode)
  const chosen = routes.find((r) => r.kind === routeKind) ?? routes[0]
  // Derived from the store, so a remount keeps "In 15 min" rather than falling back to a custom time.
  const leaveId = leaveOptionFor(leaveAt)

  const pickTime = () => {
    const input = timeInput.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      input.focus()
    }
  }

  return (
    <div data-testid="view-directions">
      <ViewHeader title="Directions" onBack={back} />

      <div className="flex items-stretch gap-2 rounded-2xl border border-border bg-card p-2">
        <div className="flex flex-col items-center justify-center gap-1 px-2 text-muted-foreground" aria-hidden>
          <span className="grid size-4 place-items-center">
            <span className="size-2.5 rounded-full bg-gold ring-2 ring-background" />
          </span>
          <span className="h-4 w-px bg-border" />
          <MapPinIcon weight="fill" className="size-4 text-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="body-3 flex min-h-tap w-full items-center rounded-lg px-2 text-left hover:bg-accent"
            onClick={() => notify({ id: 'from', title: 'Starting from your location', description: 'Picking another start point arrives with live routing.' })}
          >
            Your location
          </button>
          <div className="mx-2 h-px bg-border" />
          <button
            type="button"
            data-testid="directions-to"
            className={cn('body-3 flex min-h-tap w-full items-center truncate rounded-lg px-2 text-left hover:bg-accent', !to && 'text-muted-foreground')}
            onClick={() => directionsTo(null)}
          >
            {to?.name ?? 'Choose destination'}
          </button>
        </div>
        <button
          type="button"
          aria-label="Swap start and destination"
          className="grid w-tap place-items-center rounded-lg text-muted-foreground hover:bg-accent"
          onClick={() => notify({ id: 'swap', title: 'Swapping needs live routing', description: 'Routes back to your location arrive with the backend.' })}
        >
          <ArrowsDownUpIcon aria-hidden className="size-5" />
        </button>
      </div>

      <div className="mt-4">
        <SegmentedControl<TravelMode>
          label="Travel mode"
          options={MODES}
          value={travelMode}
          onChange={setTravelMode}
          overMap={false}
          className="w-full [&>div]:w-full"
        />
      </div>

      {!to ? (
        <Section className="mt-6" title="Choose a destination">
          {buildings.map((b) => (
            <ListRow key={b.id} icon={<PlaceIcon type="building" />} title={b.name} subtitle={b.code} onClick={() => directionsTo(b.id)} />
          ))}
        </Section>
      ) : (
        <>
          <Section className="mt-6" title="Routes">
            {travelMode === 'ride' ? (
              <p className="body-6 mb-2 text-muted-foreground">Ride times include about 4 min of pickup wait. Booking opens your rideshare app.</p>
            ) : null}
            <div className="grid gap-2">
              {routes.map((r) => (
                <RouteCard key={r.id} route={r} selected={r.id === chosen?.id} onSelect={() => setRouteKind(r.kind)} leaveAt={leaveAt} />
              ))}
            </div>
            <RouteRiskLegend />
            {!liveRouting ? <p className="caption-5 mt-2 text-muted-foreground">Preview routes. Live routing is not connected yet.</p> : null}
          </Section>

          <Section className="mt-6" title="Leave">
            <ChipRow label="Leave time">
              {LEAVE_OPTIONS.map((o) => (
                <Chip
                  key={o.id}
                  pressed={leaveId === o.id}
                  onClick={() => {
                    const iso = leaveIso(o.minutes)
                    rememberLeaveOption(iso, o.id)
                    setLeaveAt(iso)
                  }}
                >
                  {o.label}
                </Chip>
              ))}
              <Chip icon={<ClockIcon />} pressed={leaveId === 'custom'} onClick={pickTime}>
                {leaveId === 'custom' && leaveAt ? <span className="font-mono">{formatTime(leaveAt)}</span> : 'Pick a time'}
              </Chip>
            </ChipRow>
            <input
              ref={timeInput}
              type="time"
              aria-label="Leave time"
              tabIndex={-1}
              className="sr-only"
              value={leaveAt ? new Date(leaveAt).toTimeString().slice(0, 5) : ''}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number)
                if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return
                const d = new Date()
                d.setHours(h, m, 0, 0)
                if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
                setLeaveAt(d.toISOString())
              }}
            />
          </Section>

          {/* The one primary action stays in reach at every sheet height. */}
          <div className="sticky bottom-0 z-10 -mx-gutter mt-4 bg-card px-gutter pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              tone="brand"
              block
              icon={<NavigationArrowIcon weight="fill" />}
              data-testid="start-route"
              disabled={!chosen}
              onClick={() => {
                if (!chosen) return
                startRoute(chosen.id)
                notify({ id: 'route', title: `${chosen.kind === 'safest' ? 'Safest' : 'Fastest'} route started`, description: `To ${to.name}` })
              }}
            >
              Start
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
