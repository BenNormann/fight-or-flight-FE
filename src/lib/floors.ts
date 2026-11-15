import type { RoomInfo } from '@/domain'

/** "Floor 2", "Basement", "Lower level" ... from the label on the signs, falling back to the number. */
export function floorName(room: Pick<RoomInfo, 'floor' | 'floorLabel'>): string | null {
  if (room.floor == null && !room.floorLabel) return null
  const label = room.floorLabel?.trim()
  if (label && /^\d+$/.test(label)) return `Floor ${label}`
  if (label) return /^b/i.test(label) ? `Basement (${label})` : /^(ll|l)$/i.test(label) ? `Lower level (${label})` : /^g/i.test(label) ? `Ground floor (${label})` : `Level ${label}`
  const f = room.floor!
  return f >= 1 ? `Floor ${f}` : f === 0 ? 'Ground level' : f === -1 ? 'Basement' : 'Sub-basement'
}

/**
 * Storeys to climb (positive) or descend (negative) from the street entrance, which is floor 1.
 * Floor 0 is a ground level below floor 1, so it counts as one down.
 */
export const floorsFromEntrance = (floor: number) => floor - 1

/** "Up 2 floors", "Down 1 floor", or null when the room is on the entrance floor. */
export function climbText(floor: number): string | null {
  const n = floorsFromEntrance(floor)
  if (n === 0) return null
  return `${n > 0 ? 'Up' : 'Down'} ${Math.abs(n)} ${Math.abs(n) === 1 ? 'floor' : 'floors'}`
}
