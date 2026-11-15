/**
 * Two-finger tilt for 3D, replacing MapLibre's `touchPitch`.
 *
 * Why: MapLibre's pitch handler decides on the first touch sample in which
 * either finger moved 2px. Real fingers rarely start perfectly together: a
 * sideways jitter in that first sample, a finger that lags by more than 100ms,
 * or fingers placed slightly diagonally rejects tilt for the whole gesture, and
 * `touchPan` then drags the map with the fingers' centroid. This recognizer
 * looks at the movement accumulated since both fingers landed and decides once
 * there is enough of it. When it claims a tilt it stops the touch events from
 * reaching MapLibre's handlers for the rest of the gesture and pitches itself,
 * so pan, zoom and rotate cannot fight it. Otherwise it stays out of the way.
 */
import type { Map as MlMap } from 'maplibre-gl'

export interface Pt {
  x: number
  y: number
}

export type TwoFingerIntent = 'tilt' | 'other' | null

/** Movement (px) of the leading finger before deciding. */
const SLOP_PX = 10
/** Fingers stacked more steeply than this (from horizontal) are not a tilt grip. */
const MAX_GRIP_DEG = 55
/** Spread change (fraction) that reads as a pinch. */
const MAX_SPREAD = 0.15
/** Twist (degrees) that reads as a rotate. */
const MAX_TWIST_DEG = 12
/** The centroid must move this much more vertically than sideways. */
const VERTICAL_RATIO = 1.5
/** Degrees of pitch per pixel of vertical movement (MapLibre's own rate). */
export const PITCH_PER_PX = -0.5

const deg = (rad: number) => (rad * 180) / Math.PI
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)
const angle = (a: Pt, b: Pt) => Math.atan2(b.y - a.y, b.x - a.x)

/**
 * Classify a two-finger gesture from where the fingers landed (`a0`, `b0`) and
 * where they are now. `null` = not enough movement yet.
 */
export function classifyTwoFinger(a0: Pt, b0: Pt, a: Pt, b: Pt): TwoFingerIntent {
  const grip = Math.abs(deg(Math.atan2(Math.abs(b0.y - a0.y), Math.abs(b0.x - a0.x))))
  if (grip > MAX_GRIP_DEG) return 'other'
  const moved = Math.max(dist(a0, a), dist(b0, b))
  if (moved < SLOP_PX) return null
  const spread0 = dist(a0, b0)
  if (spread0 > 0 && Math.abs(dist(a, b) - spread0) / spread0 > MAX_SPREAD) return 'other'
  let twist = Math.abs(deg(angle(a, b) - angle(a0, b0)))
  if (twist > 180) twist = 360 - twist
  if (twist > MAX_TWIST_DEG) return 'other'
  const cx = (a.x - a0.x + b.x - b0.x) / 2
  const cy = (a.y - a0.y + b.y - b0.y) / 2
  return Math.abs(cy) > VERTICAL_RATIO * Math.abs(cx) ? 'tilt' : 'other'
}

const point = (t: Touch, box: DOMRect): Pt => ({ x: t.clientX - box.left, y: t.clientY - box.top })

/**
 * Install the recognizer on the map's container (capture phase, ahead of
 * MapLibre's listeners on the canvas container). `enabled` is read per gesture.
 * Returns the cleanup.
 */
export function installTouchTilt(map: MlMap, enabled: () => boolean): () => void {
  const el = map.getContainer()
  let start: [Pt, Pt] | null = null
  let ids: [number, number] | null = null
  let intent: TwoFingerIntent = null
  let lastY = 0

  const reset = () => {
    start = null
    ids = null
    intent = null
  }
  const pair = (e: TouchEvent): [Pt, Pt] | null => {
    if (!ids) return null
    const box = el.getBoundingClientRect()
    const a = Array.from(e.touches).find((t) => t.identifier === ids![0])
    const b = Array.from(e.touches).find((t) => t.identifier === ids![1])
    return a && b ? [point(a, box), point(b, box)] : null
  }

  const onStart = (e: TouchEvent) => {
    if (intent === 'tilt') {
      // A third finger during a tilt: keep MapLibre out of it.
      e.stopPropagation()
      return
    }
    const [t0, t1] = Array.from(e.touches)
    if (t0 && t1 && e.touches.length === 2 && enabled()) {
      ids = [t0.identifier, t1.identifier]
      start = pair(e)
      intent = null
    } else if (e.touches.length !== 2) {
      reset()
    }
  }

  const onMove = (e: TouchEvent) => {
    if (!start) return
    if (intent === 'tilt') {
      e.stopPropagation()
      if (e.cancelable) e.preventDefault()
      const p = pair(e)
      if (!p) return
      const y = (p[0].y + p[1].y) / 2
      map.setPitch(map.getPitch() + (y - lastY) * PITCH_PER_PX, { originalEvent: e })
      lastY = y
      return
    }
    if (intent === 'other') return
    if (e.touches.length !== 2) {
      intent = 'other'
      return
    }
    const p = pair(e)
    if (!p) return
    intent = classifyTwoFinger(start[0], start[1], p[0], p[1])
    if (intent === 'other') return // this sample and the rest go to MapLibre, which catches up from its own start
    // Undecided or tilt: hold the samples back so the map does not pan during the slop.
    e.stopPropagation()
    if (e.cancelable) e.preventDefault()
    if (intent === 'tilt') {
      map.stop()
      lastY = (p[0].y + p[1].y) / 2
    }
  }

  const onEnd = (e: TouchEvent) => {
    if (intent === 'tilt') {
      // Let only the final lift through: MapLibre resets its handlers on it.
      // Passing a one-finger touchend would let touchPan jump from a stale position.
      if (e.touches.length > 0) e.stopPropagation()
      else reset()
      return
    }
    if (e.touches.length < 2) reset()
  }

  const capture = { capture: true, passive: false } as const
  el.addEventListener('touchstart', onStart, capture)
  el.addEventListener('touchmove', onMove, capture)
  el.addEventListener('touchend', onEnd, capture)
  el.addEventListener('touchcancel', onEnd, capture)
  return () => {
    el.removeEventListener('touchstart', onStart, capture)
    el.removeEventListener('touchmove', onMove, capture)
    el.removeEventListener('touchend', onEnd, capture)
    el.removeEventListener('touchcancel', onEnd, capture)
  }
}
