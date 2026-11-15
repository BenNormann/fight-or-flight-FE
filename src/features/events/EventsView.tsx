import { CalendarPlusIcon, CalendarXIcon, NavigationArrowIcon, ShareNetworkIcon } from '@phosphor-icons/react'
import { events, findBuilding, findEvent } from '@/demo'
import type { CampusEvent } from '@/domain'
import { useAppStore } from '@/state/store'
import { ActionBar, Button, EmptyState, ListRow, PlaceIcon, Section, ViewHeader, dayLabel, formatClock, notify } from '@/ui'

function EventDetail({ event }: { event: CampusEvent }) {
  const directionsTo = useAppStore((s) => s.directionsTo)
  const select = useAppStore((s) => s.select)
  const openView = useAppStore((s) => s.openView)
  const building = findBuilding(event.buildingId)
  return (
    <div data-testid="view-event">
      <ViewHeader
        eyebrow={
          <span className="text-brand-ink">
            {dayLabel(event.start)} · <span className="font-mono">{formatClock(event.start)}</span>
            {event.end ? (
              <>
                {' '}to <span className="font-mono">{formatClock(event.end)}</span>
              </>
            ) : null}
          </span>
        }
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
            ? [{ id: 'dir', label: 'Directions', icon: <NavigationArrowIcon weight="fill" />, primary: true, onClick: () => directionsTo(building.id) }]
            : []),
          {
            id: 'cal',
            label: 'Add to calendar',
            icon: <CalendarPlusIcon />,
            onClick: () => notify({ id: 'cal', title: 'Calendar export is not connected yet', description: event.title }),
          },
          {
            id: 'share',
            label: 'Share',
            icon: <ShareNetworkIcon />,
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
            meta={<span className="font-mono">{building.code}</span>}
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
                subtitle={e.location}
                meta={<span className="font-mono">{formatClock(e.start)}</span>}
                onClick={() => select({ kind: 'event', id: e.id })}
              />
            ))}
          </Section>
        ))
      ) : (
        <EmptyState
          icon={<CalendarXIcon weight="duotone" />}
          title="Nothing scheduled yet"
          body="Talks, games and club nights show up here as they are posted."
          action={<Button onClick={back}>Back to the map</Button>}
        />
      )}
    </div>
  )
}
