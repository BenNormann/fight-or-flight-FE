import { ArrowUpIcon, MapPinIcon, PersonSimpleWalkIcon, SirenIcon, TrashIcon, VideoCameraIcon, XCircleIcon } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ApiError } from '@/api/client'
import { useClearIncidents, useDemoIncidents, useDemoStatus, useSession, useSimulateIncident } from '@/api/queries'
import type { LngLat } from '@/domain'
import { demoMode } from '@/lib/demoMode'
import { useUserLocation } from '@/lib/geo/location'
import { distanceM, fromLocal, measure, pointAlong } from '@/lib/nav'
import { useAppStore } from '@/state/store'
import { useTrip } from '@/state/trip'
import { Button, Card, Chip, ChipRow, ListRow, Section, ViewHeader, notify } from '@/ui'

/** "Ahead on my route" puts the crime this far past the traveller, so the reroute is visible before reaching it. */
export const AHEAD_M = 180
/** "Near me" puts it this far north-east of you, so you are not standing inside it. */
const NEAR_M = 70

const minutesAgo = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000))

function failure(e: unknown): string {
  if (e instanceof ApiError && e.status === 401) return 'Sign in first: simulating a crime needs a signed-in account.'
  if (e instanceof ApiError && e.status === 404) return 'The backend has demo mode off. Set DEMO_MODE=true on the server.'
  if (e instanceof ApiError && e.status === 422) return 'That point is outside the area routes are planned in.'
  return 'Could not reach the backend.'
}

/** Recording tools: simulate crimes that the route steers around. Opened from the demo icon (only with `?demo`). */
export default function DemoView() {
  const back = useAppStore((s) => s.back)
  const nav = useAppStore((s) => s.nav)
  const activeRouteId = useAppStore((s) => s.activeRouteId)
  const { routes } = useTrip()
  const { fix } = useUserLocation()
  const session = useSession()
  const status = useDemoStatus()
  const incidents = useDemoIncidents().data ?? []
  const simulate = useSimulateIncident()
  const clear = useClearIncidents()
  const client = useQueryClient()
  const categories = status.data?.categories.length ? status.data.categories : ['Robbery']
  const [category, setCategory] = useState(categories[0]!)

  const route = routes.find((r) => r.id === activeRouteId)
  const here: LngLat | null = nav?.position ?? fix?.lngLat ?? null
  const ahead = useMemo(() => {
    if (!route || !nav || nav.arrived) return null
    const cum = measure(route.path)
    const total = cum[cum.length - 1] ?? 0
    // Leave room to turn away: never on the last stretch before the destination.
    const along = Math.min(nav.progressM + AHEAD_M, total - 40)
    return along > nav.progressM + 40 ? pointAlong(route.path, cum, along).point : null
  }, [route, nav])

  const served = status.data?.enabled === true
  const signedIn = session.user !== null

  const fire = (at: LngLat | null, label: string) => {
    if (!at) return
    simulate.mutate(
      { at, category },
      { onError: (e) => notify({ id: 'demo-incident', title: `Could not simulate a crime ${label}`, description: failure(e) }) },
    )
  }

  const statusLine = !demoMode
    ? 'Demo mode is off. Open the app with ?demo to use these tools.'
    : status.isLoading
      ? 'Checking the backend…'
      : !served
        ? 'The backend has simulated crimes off (DEMO_MODE=true on the server turns them on).'
        : !signedIn
          ? 'Sign in to simulate crimes.'
          : `Routes avoid ${Math.round(status.data!.avoidRadiusM)} m around a simulated crime for ${status.data!.ttlMinutes} minutes.`

  return (
    <div data-testid="view-demo">
      <ViewHeader title="Demo" subtitle="Recording tools: a walk that moves by itself, and crimes it steers around" onBack={back} />

      <Card className="flex items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
          <VideoCameraIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="title-3">{here ? 'Your position is simulated' : 'Waiting for your simulated position'}</p>
          <p className="body-6 text-muted-foreground" data-testid="demo-status">
            {statusLine}
          </p>
        </div>
      </Card>

      <Section className="mt-6" title="Crime type">
        <ChipRow label="Crime type" bleed={false}>
          {categories.map((c) => (
            <Chip key={c} pressed={c === category} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </ChipRow>
      </Section>

      <Section className="mt-6" title="Simulate">
        <ListRow
          icon={<ArrowUpIcon />}
          title="Crime ahead on my route"
          subtitle={ahead ? `${AHEAD_M} m ahead of you; the walk reroutes around it` : 'Start a route first, then use this while walking'}
          disabled={!served || !ahead || simulate.isPending}
          onClick={() => fire(ahead, 'ahead')}
          data-testid="demo-crime-ahead"
        />
        <ListRow
          icon={<MapPinIcon />}
          title="Crime near me"
          subtitle={`About ${NEAR_M} m from where you are`}
          disabled={!served || !here || simulate.isPending}
          onClick={() => fire(here && fromLocal(here, NEAR_M * 0.7, NEAR_M * 0.7), 'near you')}
          data-testid="demo-crime-near"
        />
        <ListRow
          icon={<TrashIcon />}
          title="Clear simulated crimes"
          subtitle={incidents.length ? `${incidents.length} active` : 'None active'}
          disabled={!served || !incidents.length || clear.isPending}
          onClick={() =>
            clear.mutate(undefined, {
              // Not walking: plan the routes on screen again without the crimes. A walk keeps its route.
              onSuccess: () => (activeRouteId === null ? void client.invalidateQueries({ queryKey: ['routes'] }) : undefined),
              onError: (e) => notify({ id: 'demo-incident', title: 'Could not clear', description: failure(e) }),
            })
          }
          data-testid="demo-clear"
        />
      </Section>

      {incidents.length ? (
        <Section className="mt-6" title="Active">
          <ul className="flex flex-col gap-1" data-testid="demo-incidents">
            {incidents.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-1">
                <SirenIcon aria-hidden className="size-4 shrink-0 text-destructive" />
                <span className="body-5 min-w-0 flex-1 truncate">{i.category}</span>
                <span className="body-6 text-muted-foreground">
                  {here ? `${Math.round(distanceM(here, i.lngLat))} m · ` : ''}
                  {minutesAgo(i.at)} min ago
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section className="mt-6" title="Walking">
        <div className="flex items-start gap-3">
          <PersonSimpleWalkIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <p className="body-6 text-muted-foreground">
            Pick a destination and press Start: you walk there by yourself. Use the pause and 1× / 4× / 16× control over the map to set the pace. When you arrive, the next trip starts from there.
          </p>
        </div>
        <Button className="mt-4" block icon={<XCircleIcon />} onClick={() => window.location.assign(`${window.location.pathname}?demo=off`)} data-testid="demo-exit">
          Leave demo mode
        </Button>
      </Section>
    </div>
  )
}
