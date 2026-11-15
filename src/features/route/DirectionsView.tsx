import {
  ArrowsDownUpIcon,
  BicycleIcon,
  CarIcon,
  CheckCircleIcon,
  MapPinIcon,
  NavigationArrowIcon,
  PersonSimpleWalkIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { useCapability } from '@/api/capabilities'
import { buildings, demoRoutes, placeOf } from '@/demo'
import type { Route } from '@/domain'
import { cn } from '@/lib/cn'
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
  formatClock,
  formatDistance,
  formatDuration,
  notify,
} from '@/ui'

const MODES = [
  { value: 'walk', label: <span className="inline-flex items-center gap-2"><PersonSimpleWalkIcon aria-hidden className="size-4" />Walk</span> },
  { value: 'bike', label: <span className="inline-flex items-center gap-2"><BicycleIcon aria-hidden className="size-4" />Bike</span> },
  { value: 'ride', label: <span className="inline-flex items-center gap-2"><CarIcon aria-hidden className="size-4" />Ride</span> },
] as const

const LEAVE_OPTIONS = [
  { id: 'now', label: 'Leave now', minutes: 0 },
  { id: '15', label: 'In 15 min', minutes: 15 },
  { id: '30', label: 'In 30 min', minutes: 30 },
  { id: '60', label: 'In 1 hour', minutes: 60 },
] as const

function leaveIso(minutes: number) {
  if (!minutes) return null
  const d = new Date(Date.now() + minutes * 60_000)
  d.setSeconds(0, 0)
  return d.toISOString()
}

function RouteCard({ route, selected, onSelect, leaveAt }: { route: Route; selected: boolean; onSelect: () => void; leaveAt: string | null }) {
  const title = route.kind === 'safest' ? 'Safest' : 'Fastest'
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      data-testid={`route-card-${route.kind}`}
      className={cn(
        'flex w-full flex-col gap-2 rounded-2xl border p-4 text-left transition-[transform,background-color,border-color] duration-200 active:scale-[0.98]',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-selected bg-brand-subtle text-brand-subtle-foreground ring-1 ring-selected' : 'border-border bg-card hover:bg-accent',
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="title-3 inline-flex items-center gap-2">
          {selected ? <CheckCircleIcon aria-hidden weight="fill" className="size-5 text-brand-ink" /> : null}
          {title}
        </span>
        <RiskBadge score={route.risk.mean} />
      </span>
      <span className="flex items-baseline gap-2">
        <span className={cn('heading-5 font-mono', selected && 'text-brand-ink')}>{formatDuration(route.durationS)}</span>
        <span className="body-6 text-muted-foreground">
          {formatDistance(route.distanceM)} · arrive {formatClock(arrivalTime(route.durationS, leaveAt))}
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

  const to = placeOf(destination)
  const routes = demoRoutes(destination, travelMode)
  const chosen = routes.find((r) => r.kind === routeKind) ?? routes[0]
  const [leaveId, setLeaveId] = useState<string>(leaveAt ? 'custom' : 'now')

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
            {!liveRouting ? <p className="caption-5 mt-2 text-muted-foreground">Preview routes. Live routing is not connected yet.</p> : null}
          </Section>

          <Button
            tone="brand"
            block
            className="mt-4"
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
          <Section className="mt-6" title="Leave">
            <ChipRow label="Leave time" className="-mx-gutter -my-2 px-gutter py-2">
              {LEAVE_OPTIONS.map((o) => (
                <Chip key={o.id} pressed={leaveId === o.id} onClick={() => {
                    setLeaveId(o.id)
                    setLeaveAt(leaveIso(o.minutes))
                  }}>
                  {o.label}
                </Chip>
              ))}
              <label
                className={cn(
                  'button-sm inline-flex h-tap shrink-0 items-center gap-2 rounded-full px-4 focus-within:ring-2 focus-within:ring-ring',
                  leaveId === 'custom' ? 'bg-selected text-selected-foreground' : 'bg-secondary text-secondary-foreground',
                )}
              >
                <span className="sr-only">Pick a leave time</span>
                <input
                  type="time"
                  className="bg-transparent font-mono text-base outline-none"
                  value={leaveAt ? new Date(leaveAt).toTimeString().slice(0, 5) : ''}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number)
                    if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return
                    const d = new Date()
                    d.setHours(h, m, 0, 0)
                    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
                    setLeaveId('custom')
                    setLeaveAt(d.toISOString())
                  }}
                />
              </label>
            </ChipRow>
          </Section>

        </>
      )}
    </div>
  )
}
