import { CalendarDotsIcon, NavigationArrowIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import { buildings, events, placeMeta } from '@/demo'
import { formatTime } from '@/lib/time'
import { useAppStore } from '@/state/store'
import { ActionBar, ListRow, PlaceIcon, Section, ViewHeader, dayLabel } from '@/ui'

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
        eyebrow="USC · Sample campus"
        title="Explore University Park"
        subtitle={
          <>
            <span className="font-mono">{buildings.length}</span> buildings · <span className="font-mono">{events.length}</span> events this week
          </>
        }
      />
      <ActionBar
        actions={[
          { id: 'dir', label: 'Directions', icon: <NavigationArrowIcon weight="fill" />, primary: true, onClick: () => directionsTo(null) },
          { id: 'events', label: 'Events', icon: <CalendarDotsIcon />, onClick: () => openView('events') },
          { id: 'safety', label: 'Safety', icon: <ShieldCheckIcon />, onClick: () => openView('safety') },
        ]}
      />

      <Section
        className="mt-6"
        title="Open now"
        action={
          <button
            type="button"
            className="button-sm -mr-2 min-h-tap rounded-lg px-2 text-brand-ink outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            onClick={() => search('', 'buildings')}
          >
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
            meta={<span className="font-mono">{b.code}</span>}
            onClick={() => select({ kind: 'building', id: b.id })}
          />
        ))}
      </Section>

      <Section title="Happening soon">
        {soon.map((e) => (
          <ListRow
            key={e.id}
            icon={<PlaceIcon type="event" />}
            title={<span className="block whitespace-normal line-clamp-2">{e.title}</span>}
            subtitle={[dayLabel(e.start), e.location].filter(Boolean).join(' · ')}
            meta={<span className="font-mono">{formatTime(e.start)}</span>}
            onClick={() => select({ kind: 'event', id: e.id })}
          />
        ))}
      </Section>
    </div>
  )
}
