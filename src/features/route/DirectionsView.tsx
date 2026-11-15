import {
  ArrowsDownUpIcon,
  BicycleIcon,
  CarIcon,
  CheckCircleIcon,
  ClockIcon,
  CrosshairIcon,
  MapPinIcon,
  MapTrifoldIcon,
  NavigationArrowIcon,
  PersonSimpleWalkIcon,
  RulerIcon,
  WarningIcon,
} from '@phosphor-icons/react'
import { useRef, useState } from 'react'
// DEMO: the place list until the backend serves search (docs/BACKEND_CONTRACT.md).
import { demoSearch } from '@/demo'
import type { Route } from '@/domain'
import { cn } from '@/lib/cn'
import { LOCATION_DENIED_HELP, requestLocation, useUserLocation } from '@/lib/geo/location'
import { requestCompassPermission } from '@/lib/nav/compass'
import { riskBands } from '@/lib/risk'
import { formatTime } from '@/lib/time'
import { distanceText, durationText } from '@/lib/units'
import { useAppStore, type TravelMode, type TripEnd } from '@/state/store'
import { YOUR_LOCATION, useTrip } from '@/state/trip'
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
        <span className="heading-5 font-mono">{durationText(route.durationS)}</span>
        <span className="body-6 text-muted-foreground">
          {distanceText(route.distanceM)} · arrive {formatTime(arrivalTime(route.durationS, leaveAt))}
        </span>
      </span>
      {route.warnings.map((w) => (
        <span key={w} className="caption-4 flex items-start gap-2 text-muted-foreground">
          <WarningIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {w}
        </span>
      ))}
      {(route.highlights ?? (route.kind === 'safest' ? ['Stays on lit paths past emergency phones'] : [])).map((h) => (
        <span key={h} className="caption-4 text-muted-foreground">
          {h}
        </span>
      ))}
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

const END_LABEL: Record<TripEnd, string> = { origin: 'start', destination: 'destination' }

/** Pick one end of the trip: your location (start only), a point on the map, or a place by name. */
function EndPicker({ end, onDone }: { end: TripEnd; onDone: () => void }) {
  const setTripEnd = useAppStore((s) => s.setTripEnd)
  const setPicking = useAppStore((s) => s.setPicking)
  const [q, setQ] = useState('')
  // Only places with a position can be an end of a route.
  const places = demoSearch(q, null)
    .filter((r) => r.lngLat && (r.kind === 'building' || r.kind === 'poi'))
    .slice(0, 12)
  return (
    <Section className="mt-4" title={`Choose ${END_LABEL[end]}`}>
      <input
        type="search"
        // 16px text: iOS zooms the page on smaller inputs.
        className="mb-2 min-h-tap w-full rounded-xl border border-input bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Search places"
        aria-label={`Search for a ${END_LABEL[end]}`}
        data-testid="end-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {end === 'origin' ? (
        <ListRow
          icon={<CrosshairIcon aria-hidden className="size-5" />}
          title={YOUR_LOCATION}
          chevron={false}
          data-testid="end-my-location"
          onClick={() => {
            setTripEnd('origin', null)
            onDone()
          }}
        />
      ) : null}
      <ListRow
        icon={<MapTrifoldIcon aria-hidden className="size-5" />}
        title="Choose on map"
        subtitle="Tap any point"
        chevron={false}
        data-testid="end-on-map"
        onClick={() => {
          setPicking(end)
          onDone()
        }}
      />
      {places.map((r) => (
        <ListRow
          key={r.id}
          icon={<PlaceIcon type={r.kind === 'building' ? 'building' : 'poi'} />}
          title={r.label}
          subtitle={r.sublabel}
          chevron={false}
          onClick={() => {
            setTripEnd(end, r.id)
            onDone()
          }}
        />
      ))}
      {places.length === 0 ? <p className="body-6 py-2 text-muted-foreground">No places match. Try "Choose on map".</p> : null}
    </Section>
  )
}

/** "Your location" is the start but we do not have it: ask, or explain how to unblock it. */
function NeedsLocation({ onChooseStart }: { onChooseStart: () => void }) {
  const { status, asking, fix } = useUserLocation()
  const blocked = status === 'denied' || status === 'unsupported'
  // A position we cannot use: the device is outside the area the map covers.
  const outside = !!fix
  return (
    <Section className="mt-6" title="Where are you starting?">
      <p className="body-6 mb-3 text-muted-foreground" data-testid="needs-location">
        {outside
          ? 'You are outside the area Odyssey covers. Choose a start point to see routes.'
          : status === 'denied'
            ? LOCATION_DENIED_HELP
            : status === 'unsupported'
              ? 'This browser cannot share your location. Choose a start point instead.'
              : 'Allow location to get directions from where you are, or choose another start point.'}
      </p>
      <div className="grid gap-2">
        {blocked || outside ? null : (
          <Button tone="brand" block icon={<CrosshairIcon weight="fill" />} disabled={asking} onClick={() => void requestLocation()}>
            {asking ? 'Finding you…' : 'Use my location'}
          </Button>
        )}
        <Button block icon={<MapPinIcon />} onClick={onChooseStart}>
          Choose a start point
        </Button>
      </div>
    </Section>
  )
}

export default function DirectionsView() {
  const travelMode = useAppStore((s) => s.travelMode)
  const setTravelMode = useAppStore((s) => s.setTravelMode)
  const routeKind = useAppStore((s) => s.routeKind)
  const setRouteKind = useAppStore((s) => s.setRouteKind)
  const leaveAt = useAppStore((s) => s.leaveAt)
  const setLeaveAt = useAppStore((s) => s.setLeaveAt)
  const startRoute = useAppStore((s) => s.startRoute)
  const swapTripEnds = useAppStore((s) => s.swapTripEnds)
  const origin = useAppStore((s) => s.origin)
  const picking = useAppStore((s) => s.picking)
  const setPicking = useAppStore((s) => s.setPicking)
  const back = useAppStore((s) => s.back)
  const timeInput = useRef<HTMLInputElement>(null)
  const trip = useTrip()
  const { from, to, routes } = trip
  /** The end whose picker is open. With no destination yet, that picker is open from the start. */
  const [chosenEnd, setEditing] = useState<TripEnd | null>(null)
  const editing = chosenEnd ?? (to ? null : 'destination')

  const chosen = routes.find((r) => r.kind === routeKind) ?? routes[0]
  // Derived from the store, so a remount keeps "In 15 min" rather than falling back to a custom time.
  const leaveId = leaveOptionFor(leaveAt)
  // From somewhere else than where you stand, there is nothing to follow live: Start plays the route through.
  const preview = origin !== null

  const pickTime = () => {
    const input = timeInput.current
    if (!input) return
    try {
      input.showPicker()
    } catch {
      input.focus()
    }
  }

  const endButton = (end: TripEnd, label: string | undefined, placeholder: string) => (
    <button
      type="button"
      data-testid={end === 'origin' ? 'directions-from' : 'directions-to'}
      aria-label={`${end === 'origin' ? 'Start' : 'Destination'}: ${label ?? placeholder}. Change`}
      aria-expanded={editing === end}
      className={cn(
        'body-3 flex min-h-tap w-full items-center truncate rounded-lg px-2 text-left hover:bg-accent',
        !label && 'text-muted-foreground',
        (editing === end || picking === end) && 'bg-accent',
      )}
      onClick={() => {
        setPicking(null)
        setEditing(editing === end ? null : end)
      }}
    >
      <span className="truncate">{label ?? placeholder}</span>
    </button>
  )

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
          {endButton('origin', origin === null ? YOUR_LOCATION : from?.name, 'Choose start')}
          <div className="mx-2 h-px bg-border" />
          {endButton('destination', to?.name, 'Choose destination')}
        </div>
        <button
          type="button"
          aria-label="Swap start and destination"
          data-testid="swap-ends"
          className="grid w-tap place-items-center rounded-lg text-muted-foreground hover:bg-accent"
          onClick={() => {
            setEditing(null)
            swapTripEnds()
          }}
        >
          <ArrowsDownUpIcon aria-hidden className="size-5" />
        </button>
      </div>

      {picking ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-card p-3" data-testid="picking-hint" role="status">
          <MapTrifoldIcon aria-hidden className="size-5 shrink-0" />
          <p className="body-6 min-w-0 flex-1">Tap the map to set the {END_LABEL[picking]}.</p>
          <Button onClick={() => setPicking(null)}>Cancel</Button>
        </div>
      ) : editing ? (
        <EndPicker end={editing} onDone={() => setEditing(null)} />
      ) : trip.status === 'needs-location' ? (
        <NeedsLocation onChooseStart={() => setEditing('origin')} />
      ) : trip.status === 'incomplete' ? (
        <Section className="mt-6" title="Choose a start point">
          <Button block icon={<MapPinIcon />} onClick={() => setEditing('origin')}>
            Choose a start point
          </Button>
        </Section>
      ) : (
        <>
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

          <Section className="mt-6" title="Routes">
            {trip.crowFliesM !== null ? (
              <p className="body-6 mb-2 flex items-center gap-2 text-muted-foreground" data-testid="trip-distance">
                <RulerIcon aria-hidden className="size-4 shrink-0" />
                <span>
                  <span className="font-mono text-foreground">{distanceText(trip.crowFliesM)}</span> apart in a straight line
                </span>
              </p>
            ) : null}
            {travelMode === 'ride' ? (
              <p className="body-6 mb-2 text-muted-foreground">Ride times include about 4 min of pickup wait. Booking opens your rideshare app.</p>
            ) : null}
            {trip.status === 'loading' ? (
              <div className="grid gap-2" role="status" aria-label="Finding routes" data-testid="routes-loading">
                <div className="h-28 animate-pulse rounded-2xl border border-border bg-muted motion-reduce:animate-none" />
                <div className="h-28 animate-pulse rounded-2xl border border-border bg-muted motion-reduce:animate-none" />
              </div>
            ) : trip.status === 'error' ? (
              <div className="rounded-2xl border border-border bg-card p-4" role="alert" data-testid="routes-error">
                <p className="body-3 flex items-start gap-2">
                  <WarningIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
                  {trip.message}
                </p>
                <Button className="mt-3" onClick={trip.retry}>
                  Try again
                </Button>
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  {routes.map((r) => (
                    <RouteCard key={r.id} route={r} selected={r.id === chosen?.id} onSelect={() => setRouteKind(r.kind)} leaveAt={leaveAt} />
                  ))}
                </div>
                <RouteRiskLegend />
                {!trip.live ? <p className="caption-5 mt-2 text-muted-foreground">Preview routes. Live routing is not connected yet.</p> : null}
                {trip.live && travelMode !== 'walk' ? (
                  <p className="caption-5 mt-2 text-muted-foreground">Routes follow walking paths. Only the time changes with the travel mode.</p>
                ) : null}
              </>
            )}
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
                // iOS only grants the compass from a user gesture: ask here, before navigation starts. Never blocks starting.
                if (!preview) void requestCompassPermission()
                startRoute(chosen.id)
              }}
            >
              {preview ? 'Preview' : 'Start'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
