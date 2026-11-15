/**
 * Position sources behind one interface. The navigation driver picks one; the
 * rest of the pipeline (tracker, progress) does not know which.
 */
import type { LngLat } from '@/domain'
import { fromLocal, measure, pointAlong } from './geo'
import type { RawFix } from './tracker'

export const POSITION_SOURCES = ['simulated', 'device'] as const
export type PositionSourceId = (typeof POSITION_SOURCES)[number]

export interface PositionSource {
  /** Starts delivering fixes and returns stop. Starting again after a stop resumes (a walk keeps its place). */
  start(onFix: (fix: RawFix) => void, onError?: (message: string) => void): () => void
}

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export interface SimulatedWalkOptions {
  /** Read on every tick, so a speed control applies immediately. */
  speedMps: () => number
  paused?: () => boolean
  /** Metres to the right of the route (negative: left), read on every tick: walks off the route to try rerouting. */
  sidestepM?: () => number
  /** GPS-like: one fix a second. */
  intervalMs?: number
  /** Position noise, metres either way, so smoothing has something to do. */
  jitterM?: number
  accuracyM?: number
  now?: () => number
  random?: () => number
}

/** Walks the route at a set speed and reports fixes like a phone would. */
export function simulatedWalk(path: LngLat[], o: SimulatedWalkOptions): PositionSource {
  const cum = measure(path)
  const end = cum[cum.length - 1] ?? 0
  const now = o.now ?? defaultNow
  const random = o.random ?? Math.random
  const jitter = o.jitterM ?? 2.5
  let along = 0
  let last: number | null = null

  const sample = (): RawFix => {
    const t = now()
    // Cap the step so resuming after a stop (hidden page, pause) never teleports.
    const dt = last === null ? 0 : Math.min((t - last) / 1000, 2)
    last = t
    const paused = o.paused?.() ?? false
    const speed = paused || along >= end ? 0 : o.speedMps()
    along = Math.min(end, along + speed * dt)
    const { point: onRoute, bearingDeg } = pointAlong(path, cum, along)
    const side = o.sidestepM?.() ?? 0
    const b = ((bearingDeg + 90) * Math.PI) / 180
    const point = side ? fromLocal(onRoute, side * Math.sin(b), side * Math.cos(b)) : onRoute
    const k = 1 / 111_320
    const noise = () => (random() * 2 - 1) * jitter * k
    return {
      lngLat: [point[0] + noise() / Math.cos((point[1] * Math.PI) / 180), point[1] + noise()],
      accuracyM: o.accuracyM ?? 5,
      speedMps: speed,
      courseDeg: bearingDeg,
      t,
    }
  }

  return {
    start(onFix) {
      last = null
      onFix(sample())
      const id = setInterval(() => onFix(sample()), o.intervalMs ?? 1000)
      return () => clearInterval(id)
    },
  }
}

/** The phone's own GPS, high accuracy. Heading comes from the compass source, not from here. */
export function deviceSource(geo: Geolocation | undefined = typeof navigator !== 'undefined' ? navigator.geolocation : undefined, now = defaultNow): PositionSource {
  return {
    start(onFix, onError) {
      if (!geo) {
        onError?.('Location is not available on this device')
        return () => {}
      }
      const id = geo.watchPosition(
        (p) => {
          const { longitude, latitude, accuracy, speed, heading } = p.coords
          onFix({
            lngLat: [longitude, latitude],
            accuracyM: accuracy,
            ...(speed != null && Number.isFinite(speed) ? { speedMps: speed } : {}),
            ...(heading != null && Number.isFinite(heading) ? { courseDeg: heading } : {}),
            t: now(),
          })
        },
        (e) => onError?.(e.code === e.PERMISSION_DENIED ? 'Location permission was denied' : 'Location is unavailable right now'),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      )
      return () => geo.clearWatch(id)
    },
  }
}
