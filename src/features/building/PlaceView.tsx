import { BookmarkSimpleIcon, BuildingsIcon, MapPinSimpleIcon, NavigationArrowIcon, PhoneIcon, ShareNetworkIcon, WheelchairIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { POI_LABEL, events, findBuilding, findPoi, findRoom, placeMeta, roomsIn } from '@/demo'
import type { Building, Id, Poi, Room } from '@/domain'
import { formatTime } from '@/lib/time'
import { useAppStore } from '@/state/store'
import { BusinessDetail } from './BusinessDetail'
import {
  ActionBar,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ListRow,
  PlaceIcon,
  Section,
  ViewHeader,
  dayLabel,
  notify,
  type ActionItem,
} from '@/ui'

function share(title: string) {
  const url = window.location.href
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => undefined)
    return
  }
  navigator.clipboard
    ?.writeText(url)
    .then(() => notify({ id: 'share', title: 'Link copied', description: title }))
    .catch(() => notify({ id: 'share', title: 'Could not copy the link', description: 'Copy it from the address bar instead.' }))
}

function useCommonActions(id: Id, name: string): ActionItem[] {
  const directionsTo = useAppStore((s) => s.directionsTo)
  return [
    { id: 'dir', label: 'Directions', icon: <NavigationArrowIcon weight="fill" />, primary: true, onClick: () => directionsTo(id) },
    {
      id: 'save',
      label: 'Save',
      icon: <BookmarkSimpleIcon />,
      onClick: () => notify({ id: 'save', title: 'Saving places needs an account', description: 'Sign in arrives with the backend.' }),
    },
    { id: 'share', label: 'Share', icon: <ShareNetworkIcon />, onClick: () => share(name) },
  ]
}

function Hours({ id }: { id: Id }) {
  const meta = placeMeta[id]
  if (!meta?.hours) return null
  return (
    <span className={meta.openNow ? 'inline-flex items-center gap-2 text-foreground' : 'text-muted-foreground'}>
      {meta.openNow ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-gold" /> : null}
      {meta.openNow ? meta.hours : `Closed now · ${meta.hours}`}
    </span>
  )
}

function BuildingDetail({ building }: { building: Building }) {
  const select = useAppStore((s) => s.select)
  const back = useAppStore((s) => s.back)
  const actions = useCommonActions(building.id, building.name)
  const rooms = roomsIn(building.id)
  const floors = [...new Set(rooms.map((r) => r.floor))]
  const [floor, setFloor] = useState<string | null>(null)
  const shown = floor ? rooms.filter((r) => r.floor === floor) : rooms
  const here = events.filter((e) => e.buildingId === building.id)

  return (
    <div data-testid="view-place">
      <ViewHeader
        eyebrow={<>Building · <span className="font-mono">{building.code}</span></>}
        title={building.name}
        subtitle={
          <>
            <Hours id={building.id} />
            {building.address ? <span className="block">{building.address}</span> : null}
          </>
        }
        onBack={back}
      />
      <ActionBar actions={actions} />
      {placeMeta[building.id]?.blurb ? <p className="body-6 mt-4 text-muted-foreground">{placeMeta[building.id]?.blurb}</p> : null}

      <Section className="mt-6" title={`Rooms · ${building.floors ?? floors.length} floors`}>
        {floors.length ? (
          <>
            <div className="mb-3">
              <ChipRow label="Floors">
                <Chip pressed={floor === null} onClick={() => setFloor(null)}>
                  All
                </Chip>
                {floors.map((f) => (
                  <Chip key={f} pressed={floor === f} onClick={() => setFloor(f)}>
                    {f === 'G' ? 'Ground' : f === 'B1' ? 'Basement' : `Floor ${f}`}
                  </Chip>
                ))}
              </ChipRow>
            </div>
            {shown.map((r) => (
              <ListRow
                key={r.id}
                icon={<PlaceIcon type="room" />}
                title={r.name}
                subtitle={[r.type, r.capacity ? `${r.capacity} seats` : null].filter(Boolean).join(' · ')}
                meta={r.floor}
                onClick={() => select({ kind: 'room', id: r.id })}
              />
            ))}
          </>
        ) : (
          <EmptyState icon={<BuildingsIcon weight="duotone" />} title="No rooms listed yet" body="Indoor maps for this building arrive with the backend." />
        )}
      </Section>

      <Section title="Entrances">
        {building.entrances.map((e) => (
          <div key={e.id} className="flex min-h-14 items-center gap-3">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted">
              <MapPinSimpleIcon className="size-5" />
            </span>
            <span className="title-3 min-w-0 flex-1 truncate">{e.name ?? 'Entrance'}</span>
            {e.accessible ? (
              <span className="caption-4 inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                <WheelchairIcon aria-hidden className="size-4" /> Step free
              </span>
            ) : null}
          </div>
        ))}
      </Section>

      {here.length ? (
        <Section title="Events here">
          {here.map((e) => (
            <ListRow
              key={e.id}
              icon={<PlaceIcon type="event" />}
              title={<span className="block whitespace-normal line-clamp-2">{e.title}</span>}
              subtitle={dayLabel(e.start)}
              meta={<span className="font-mono">{formatTime(e.start)}</span>}
              onClick={() => select({ kind: 'event', id: e.id })}
            />
          ))}
        </Section>
      ) : null}
    </div>
  )
}

function RoomDetail({ room }: { room: Room }) {
  const select = useAppStore((s) => s.select)
  const building = findBuilding(room.buildingId)
  const actions = useCommonActions(room.id, room.name)
  return (
    <div data-testid="view-place">
      <ViewHeader
        eyebrow={`Room · ${room.floor === 'G' ? 'Ground floor' : `Floor ${room.floor}`}`}
        title={room.name}
        subtitle={building ? `In ${building.name}` : undefined}
        onBack={() => (building ? select({ kind: 'building', id: building.id }) : select(null))}
        backLabel={building ? `Back to ${building.name}` : 'Back'}
      />
      <ActionBar actions={actions} />
      <Card className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <p className="caption-4 text-muted-foreground">Type</p>
          <p className="heading-5">{room.type ?? 'Room'}</p>
        </div>
        <div>
          <p className="caption-4 text-muted-foreground">Capacity</p>
          <p className="heading-5 font-mono">{room.capacity ?? 'n/a'}</p>
        </div>
      </Card>
      {building ? (
        <Section className="mt-6" title="Building">
          <ListRow
            icon={<PlaceIcon type="building" />}
            title={building.name}
            subtitle={building.address}
            onClick={() => select({ kind: 'building', id: building.id })}
          />
        </Section>
      ) : null}
    </div>
  )
}

function PoiDetail({ poi }: { poi: Poi }) {
  const back = useAppStore((s) => s.back)
  const common = useCommonActions(poi.id, poi.name ?? 'Place')
  const callable = poi.type === 'dps' || poi.type === 'blue_light'
  const actions: ActionItem[] = callable
    ? [
        {
          id: 'call',
          label: 'Call',
          icon: <PhoneIcon />,
          onClick: () =>
            notify({
              id: 'call',
              politeness: 'alert',
              title: 'Calling is not connected in this preview',
              description: 'In an emergency, dial 911.',
            }),
        },
        ...common,
      ]
    : common
  return (
    <div data-testid="view-place">
      <ViewHeader eyebrow={POI_LABEL[poi.type] ?? 'Place'} title={poi.name ?? POI_LABEL[poi.type] ?? 'Place'} subtitle={<Hours id={poi.id} />} onBack={back} />
      <ActionBar actions={actions} />
      {poi.type === 'blue_light' ? (
        <p className="body-6 mt-4 text-muted-foreground">Press the button on the pole to talk to campus police. The call box shares its location automatically.</p>
      ) : null}
    </div>
  )
}

/** Building, room or point of interest, driven by the store selection. */
export default function PlaceView() {
  const selection = useAppStore((s) => s.selection)
  const back = useAppStore((s) => s.back)
  if (selection?.kind === 'place') return <BusinessDetail id={selection.id} />
  if (selection?.kind === 'building') {
    const b = findBuilding(selection.id)
    if (b) return <BuildingDetail building={b} />
  }
  if (selection?.kind === 'room') {
    const r = findRoom(selection.id)
    if (r) return <RoomDetail room={r} />
  }
  if (selection?.kind === 'poi') {
    const p = findPoi(selection.id)
    if (p) return <PoiDetail poi={p} />
  }
  return (
    <div data-testid="view-place">
      <ViewHeader title="Place not found" onBack={back} />
      <EmptyState icon={<BuildingsIcon weight="duotone" />} title="This place is not on the map" body="The link may be out of date. Search for it by name instead." action={<Button onClick={back}>Back to the map</Button>} />
    </div>
  )
}
