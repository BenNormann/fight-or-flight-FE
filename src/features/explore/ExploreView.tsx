import { CalendarDotsIcon, NavigationArrowIcon, ShieldCheckIcon } from '@phosphor-icons/react'
import { usePlaceCategories } from '@/api/queries'
import { buildings, events, placeMeta } from '@/demo'
import { formatTime } from '@/lib/time'
import { useAppStore } from '@/state/store'
import { ActionBar, CategoryIcon, ListRow, PlaceIcon, Section, ViewHeader, dayLabel } from '@/ui'

/** Home view: what the sheet peeks with, and the desktop panel's default. */
export default function ExploreView() {
  const select = useAppStore((s) => s.select)
  const openView = useAppStore((s) => s.openView)
  const directionsTo = useAppStore((s) => s.directionsTo)
  const search = useAppStore((s) => s.search)
  const openPlaces = buildings.filter((b) => placeMeta[b.id]?.openNow).slice(0, 5)
  const soon = [...events].sort((a, b) => a.start.localeCompare(b.start)).slice(0, 2)
  // Real places from the backend: browse those, and leave the sample campus out.
  const categories = usePlaceCategories().data ?? []

  if (categories.length) {
    const total = categories.reduce((n, c) => n + c.count, 0)
    return (
      <div data-testid="view-explore" data-live>
        <ViewHeader
          eyebrow="USC and nearby"
          title="Explore University Park"
          subtitle={
            <>
              <span className="font-mono">{total.toLocaleString()}</span> places to search
            </>
          }
        />
        <ActionBar
          actions={[
            { id: 'dir', label: 'Directions', icon: <NavigationArrowIcon weight="fill" />, primary: true, onClick: () => directionsTo(null) },
            { id: 'safety', label: 'Safety', icon: <ShieldCheckIcon />, onClick: () => openView('safety') },
          ]}
        />
        <Section className="mt-6" title="Browse nearby">
          {categories.map((c) => (
            <ListRow key={c.id} icon={<CategoryIcon id={c.id} />} title={c.label} meta={<span className="font-mono">{c.count.toLocaleString()}</span>} onClick={() => search('', c.id)} />
          ))}
        </Section>
      </div>
    )
  }

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
