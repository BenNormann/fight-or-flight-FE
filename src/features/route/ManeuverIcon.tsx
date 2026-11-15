import {
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
  ArrowDownLeftIcon,
  ArrowDownRightIcon,
  ArrowUUpLeftIcon,
  ArrowUpIcon,
  ArrowUpLeftIcon,
  ArrowUpRightIcon,
  FlagCheckeredIcon,
  NavigationArrowIcon,
  type Icon,
} from '@phosphor-icons/react'
import type { Maneuver } from '@/domain'

const ICONS: Record<Maneuver, Icon> = {
  depart: ArrowUpIcon,
  straight: ArrowUpIcon,
  'slight-left': ArrowUpLeftIcon,
  left: ArrowBendUpLeftIcon,
  'sharp-left': ArrowDownLeftIcon,
  'slight-right': ArrowUpRightIcon,
  right: ArrowBendUpRightIcon,
  'sharp-right': ArrowDownRightIcon,
  'u-turn': ArrowUUpLeftIcon,
  arrive: FlagCheckeredIcon,
}

/** Arrow for a maneuver. Decorative: the instruction text beside it carries the meaning. */
export function ManeuverIcon({ maneuver, className, weight = 'regular' }: { maneuver: Maneuver; className?: string; weight?: 'regular' | 'fill' }) {
  const I = ICONS[maneuver] ?? NavigationArrowIcon
  return <I aria-hidden weight={weight} className={className} />
}
