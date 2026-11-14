import { CalendarDays, Navigation, ShieldCheck } from 'lucide-react'
import { buildings, events, placeMeta } from '@/demo'
import { useAppStore } from '@/state/store'
import { ActionBar, ListRow, PlaceIcon, Section, ViewHeader, dayLabel, formatClock } from '@/ui'

/** Home view: what the sheet peeks with, and the desktop panel's default. */
export default function ExploreView() {
  const select = useAppStore((s) => s.select)
  const openView = useAppStore((s) => s.openView)
  const directionsTo = useAppStore((s) => s.directionsTo)
  const search = useAppStore((s) => s.search)
  const openPlaces = buildings.filter((b) => placeMeta[b.id]?.openNow).slice(0, 5)
  const soon = [...events].sort((a, b) => a.start.localeCompare(b.start)).slice(0, 2)

  return (
    <div data-testid="view-explore">
      <ViewHeader
        title="Explore Northfield"
        subtitle={`${buildings.length} buildings on campus · ${events.length} events this week`}
      />
      <ActionBar
        actions={[
          { id: 'dir', label: 'Directions', icon: <Navigation />, primary: true, onClick: () => directionsTo(null) },
          { id: 'events', label: 'Events', icon: <CalendarDays />, onClick: () => openView('events') },
          { id: 'safety', label: 'Safety', icon: <ShieldCheck />, onClick: () => openView('safety') },
        ]}
      />

      <Section
        className="mt-6"
        title="Open now"
        action={
          <button type="button" className="button-sm min-h-tap rounded-lg px-2 hover:bg-accent" onClick={() => search('', 'buildings')}>
            See all
          </button>
        }
      >
        {openPlaces.map((b) => (
          <ListRow
            key={b.id}
            icon={<PlaceIcon type="building" />}
            title={b.name}
            subtitle={placeMeta[b.id]?.hours}
            onClick={() => select({ kind: 'building', id: b.id })}
          />
        ))}
      </Section>

      <Section title="Happening soon">
        {soon.map((e) => (
          <ListRow
            key={e.id}
            icon={<PlaceIcon type="event" />}
            title={e.title}
            subtitle={`${dayLabel(e.start)} · ${formatClock(e.start)} · ${e.location ?? ''}`}
            onClick={() => select({ kind: 'event', id: e.id })}
          />
        ))}
      </Section>
    </div>
  )
}
