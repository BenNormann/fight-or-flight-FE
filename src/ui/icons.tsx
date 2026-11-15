import {
  BicycleIcon,
  BookOpenIcon,
  BuildingsIcon,
  CalendarDotsIcon,
  CoffeeIcon,
  DoorOpenIcon,
  ForkKnifeIcon,
  LetterCirclePIcon,
  MapPinIcon,
  PhoneIcon,
  ShieldCheckIcon,
  type Icon,
  type IconWeight,
} from '@phosphor-icons/react'

/** One Phosphor icon per category chip and place type, so the map and lists agree. */
const categoryIcon: Record<string, Icon> = {
  buildings: BuildingsIcon,
  food: ForkKnifeIcon,
  cafe: CoffeeIcon,
  study: BookOpenIcon,
  parking: LetterCirclePIcon,
  events: CalendarDotsIcon,
  safety: ShieldCheckIcon,
}

const placeTypeIcon: Record<string, Icon> = {
  building: BuildingsIcon,
  room: DoorOpenIcon,
  event: CalendarDotsIcon,
  blue_light: PhoneIcon,
  dps: ShieldCheckIcon,
  cafe: CoffeeIcon,
  parking: LetterCirclePIcon,
  bike_rack: BicycleIcon,
  entrance: DoorOpenIcon,
}

interface GlyphProps {
  className?: string
  /** Omit to inherit from the nearest Phosphor `IconContext` (e.g. Fill inside a pressed chip). */
  weight?: IconWeight
}

export function PlaceIcon({ type, className, weight }: GlyphProps & { type: string }) {
  const Glyph = placeTypeIcon[type] ?? MapPinIcon
  return <Glyph aria-hidden className={className} weight={weight} />
}

export function CategoryIcon({ id, className, weight }: GlyphProps & { id: string }) {
  const Glyph = categoryIcon[id] ?? MapPinIcon
  return <Glyph aria-hidden className={className} weight={weight} />
}
