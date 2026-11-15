import type { SheetSnap } from '@/domain'

/** Top to bottom: index 0 is the highest snap. */
export const SNAP_ORDER: readonly SheetSnap[] = ['full', 'half', 'peek']

/** Downward translation of the full-height sheet at each snap, in px. */
export type SnapOffsets = Record<SheetSnap, number>

export function snapOffsets(sheetHeight: number, peekPx: number): SnapOffsets {
  return { full: 0, half: Math.round(sheetHeight / 2), peek: Math.max(0, sheetHeight - peekPx) }
}

/** Past the ends the sheet follows the finger at a fifth of the distance. */
export function rubberBand(y: number, offsets: SnapOffsets): number {
  if (y < offsets.full) return offsets.full + (y - offsets.full) * 0.2
  if (y > offsets.peek) return offsets.peek + (y - offsets.peek) * 0.2
  return y
}

const PROJECT_S = 0.15
const FLICK_PX_S = 600

/**
 * Where a released sheet settles: the snap nearest to where it would coast in
 * 150ms. A flick that would land back on the starting snap moves one step instead.
 * `velocity` is px/s, positive = downward.
 */
export function releaseSnap(from: SheetSnap, y: number, velocity: number, offsets: SnapOffsets): SheetSnap {
  const projected = y + velocity * PROJECT_S
  let best: SheetSnap = from
  for (const s of SNAP_ORDER) if (Math.abs(offsets[s] - projected) < Math.abs(offsets[best] - projected)) best = s
  if (best === from && Math.abs(velocity) > FLICK_PX_S) {
    const i = SNAP_ORDER.indexOf(from) + (velocity > 0 ? 1 : -1)
    best = SNAP_ORDER[Math.min(SNAP_ORDER.length - 1, Math.max(0, i))] ?? from
  }
  return best
}

export type DragOwner = 'sheet' | 'content' | 'none'

/**
 * Who owns a touch drag on the sheet, decided once from its first clear movement
 * (Google Maps behaviour): at peek and half the sheet moves; at full the content
 * scrolls, except a downward drag from scroll-top, which lowers the sheet. The
 * header always moves the sheet. Sideways drags belong to whatever scrolls sideways.
 */
export function dragOwner(o: { snap: SheetSnap; onHeader: boolean; scrollTop: number; dx: number; dy: number }): DragOwner {
  if (o.onHeader) return 'sheet'
  if (Math.abs(o.dx) > Math.abs(o.dy)) return 'none'
  if (o.snap !== 'full') return 'sheet'
  return o.dy > 0 && o.scrollTop <= 0 ? 'sheet' : 'content'
}
