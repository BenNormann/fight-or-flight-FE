import { Flame, Footprints, Phone, Route, Share2, ShieldCheck, Users } from 'lucide-react'
import { ORIGIN, pois, project } from '@/demo'
import { useAppStore } from '@/state/store'
import { Card, ListRow, Section, ViewHeader, notify } from '@/ui'

/** Nearest emergency phone to the demo origin (a backend query later). */
function nearestBlueLight() {
  const [ox, oy] = project(ORIGIN)
  return pois
    .filter((p) => p.type === 'blue_light')
    .map((p) => {
      const [x, y] = project(p.lngLat)
      return { p, d: Math.hypot(x - ox, y - oy) }
    })
    .sort((a, b) => a.d - b.d)[0]?.p
}

const notConnected = (title: string) =>
  notify({ id: 'safety', politeness: 'alert', title, description: 'Not connected in this preview. In an emergency, dial 911.' })

export default function SafetyView() {
  const select = useAppStore((s) => s.select)
  const back = useAppStore((s) => s.back)
  const directionsTo = useAppStore((s) => s.directionsTo)
  const setRouteKind = useAppStore((s) => s.setRouteKind)
  const toggleLayer = useAppStore((s) => s.toggleLayer)
  const heatOn = useAppStore((s) => s.layerOverrides['demo-safety'] ?? false)
  const blue = nearestBlueLight()

  return (
    <div data-testid="view-safety">
      <ViewHeader title="Safety" subtitle="Help and safer ways to get around campus" onBack={back} />
      <Card className="flex items-center gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground">
          <Phone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="title-3">In danger right now?</p>
          <p className="body-6 text-muted-foreground">Call 911. Campus police answer 24 hours.</p>
        </div>
        <button
          type="button"
          onClick={() => notConnected('Calling campus police')}
          className="button-sm h-tap shrink-0 rounded-xl bg-destructive px-3 text-destructive-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
        >
          Call
        </button>
      </Card>

      <Section className="mt-6" title="Get there safely">
        <ListRow
          icon={<Route />}
          title="Safest route to a building"
          subtitle="Lit paths past emergency phones"
          onClick={() => {
            setRouteKind('safest')
            directionsTo(null)
          }}
        />
        <ListRow icon={<Users />} title="Request a safety escort" subtitle="A trained walker meets you" onClick={() => notConnected('Requesting an escort')} />
        <ListRow icon={<Footprints />} title="Walk with me" subtitle="A friend follows your trip live" onClick={() => notConnected('Starting Walk with me')} />
        <ListRow icon={<Share2 />} title="Share my location" subtitle="Send a live link for one hour" onClick={() => notConnected('Sharing your location')} />
      </Section>

      <Section title="Nearby">
        {blue ? (
          <ListRow icon={<Phone />} title="Nearest emergency phone" subtitle={blue.name} onClick={() => select({ kind: 'poi', id: blue.id })} />
        ) : null}
        <ListRow icon={<ShieldCheck />} title="Campus police station" subtitle="Church St, staffed 24 hours" onClick={() => select({ kind: 'poi', id: 'p-dps' })} />
        <ListRow
          icon={<Flame />}
          title={heatOn ? 'Hide safety heat' : 'Show safety heat on the map'}
          subtitle="Relative risk by area"
          chevron={false}
          onClick={() => toggleLayer('demo-safety', !heatOn)}
        />
      </Section>
    </div>
  )
}
