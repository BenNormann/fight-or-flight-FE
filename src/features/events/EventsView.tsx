import { CalendarPlus, CalendarX, Navigation, Share2 } from 'lucide-react'
import { events, findBuilding, findEvent } from '@/demo'
import type { CampusEvent } from '@/domain'
import { useAppStore } from '@/state/store'
import { ActionBar, Card, EmptyState, ListRow, PlaceIcon, Section, ViewHeader, dayLabel, formatClock, notify } from '@/ui'

function EventDetail({ event }: { event: CampusEvent }) {
  const directionsTo = useAppStore((s) => s.directionsTo)
  const select = useAppStore((s) => s.select)
  const openView = useAppStore((s) => s.openView)
  const building = findBuilding(event.buildingId)
  return (
    <div data-testid="view-event">
      <ViewHeader
        eyebrow={`${dayLabel(event.start)} · ${formatClock(event.start)}${event.end ? ` to ${formatClock(event.end)}` : ''}`}
        title={event.title}
        subtitle={[event.location, building?.name].filter(Boolean).join(', ')}
        onBack={() => {
          select(null)
          openView('events')
        }}
        backLabel="All events"
      />
      <ActionBar
        actions={[
          ...(building
            ? [{ id: 'dir', label: 'Directions', icon: <Navigation />, primary: true, onClick: () => directionsTo(building.id) }]
            : []),
          {
            id: 'cal',
            label: 'Add to calendar',
            icon: <CalendarPlus />,
            onClick: () => notify({ id: 'cal', title: 'Calendar export is not connected yet', description: event.title }),
          },
          {
            id: 'share',
            label: 'Share',
            icon: <Share2 />,
            onClick: () => notify({ id: 'share', title: 'Sharing events arrives with the backend', description: event.title }),
          },
        ]}
      />
      {building ? (
        <Section className="mt-6" title="Where">
          <ListRow
            icon={<PlaceIcon type="building" />}
            title={building.name}
            subtitle={event.location}
            onClick={() => select({ kind: 'building', id: building.id })}
          />
        </Section>
      ) : null}
    </div>
  )
}

export default function EventsView() {
  const selection = useAppStore((s) => s.selection)
  const select = useAppStore((s) => s.select)
  const back = useAppStore((s) => s.back)
  const selected = selection?.kind === 'event' ? findEvent(selection.id) : undefined
  if (selected) return <EventDetail event={selected} />

  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start))
  const groups = new Map<string, CampusEvent[]>()
  for (const e of sorted) {
    const k = dayLabel(e.start)
    groups.set(k, [...(groups.get(k) ?? []), e])
  }

  return (
    <div data-testid="view-events">
      <ViewHeader title="Events" subtitle="On campus in the next few days" onBack={back} />
      {groups.size ? (
        [...groups].map(([day, list]) => (
          <Section key={day} title={day}>
            {list.map((e) => (
              <ListRow
                key={e.id}
                icon={<PlaceIcon type="event" />}
                title={e.title}
                subtitle={`${formatClock(e.start)} · ${e.location ?? ''}`}
                onClick={() => select({ kind: 'event', id: e.id })}
              />
            ))}
          </Section>
        ))
      ) : (
        <Card>
          <EmptyState icon={<CalendarX />} title="Nothing scheduled" body="Check back later for talks, games and club nights." />
        </Card>
      )}
    </div>
  )
}
