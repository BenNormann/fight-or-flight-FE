import {
  Bike,
  BookOpen,
  Building2,
  CalendarDays,
  Coffee,
  DoorOpen,
  MapPin,
  Phone,
  ShieldCheck,
  SquareParking,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

/** One icon per category chip and place type, so the map and lists agree. */
const categoryIcon: Record<string, LucideIcon> = {
  buildings: Building2,
  food: Utensils,
  study: BookOpen,
  parking: SquareParking,
  events: CalendarDays,
  safety: ShieldCheck,
}

const placeTypeIcon: Record<string, LucideIcon> = {
  building: Building2,
  room: DoorOpen,
  event: CalendarDays,
  blue_light: Phone,
  dps: ShieldCheck,
  cafe: Coffee,
  parking: SquareParking,
  bike_rack: Bike,
  entrance: DoorOpen,
}

export function PlaceIcon({ type, className }: { type: string; className?: string }) {
  const Icon = placeTypeIcon[type] ?? MapPin
  return <Icon aria-hidden className={className} />
}

export function CategoryIcon({ id, className }: { id: string; className?: string }) {
  const Icon = categoryIcon[id] ?? MapPin
  return <Icon aria-hidden className={className} />
}
