import {
  Bicycle,
  BookOpen,
  Buildings,
  CalendarDots,
  Coffee,
  DoorOpen,
  LetterCircleP,
  MapPin,
  Phone,
  ShieldCheck,
  type Icon,
} from '@phosphor-icons/react'

/** Phosphor glyph per place type for map pins. Regular at rest, Fill when selected. */
const pinIcon: Record<string, Icon> = {
  building: Buildings,
  room: DoorOpen,
  entrance: DoorOpen,
  event: CalendarDots,
  blue_light: Phone,
  dps: ShieldCheck,
  cafe: Coffee,
  library: BookOpen,
  parking: LetterCircleP,
  bike_rack: Bicycle,
}

export function PinIcon({ type, selected }: { type: string; selected: boolean }) {
  const Glyph = pinIcon[type] ?? MapPin
  return <Glyph aria-hidden weight={selected ? 'fill' : 'regular'} />
}
