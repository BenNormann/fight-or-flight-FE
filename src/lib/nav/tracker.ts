/**
 * Smoothing and prediction between position fixes. Pure: time comes in as an
 * argument (ms on one monotonic clock, e.g. `performance.now()`).
 *
 * Fixes arrive about once a second from GPS, far less often indoors or in the
 * background. Each fix is snapped to the route, outliers are dropped, and the
 * along-route distance is blended with the prediction by accuracy. Between
 * fixes the position dead-reckons at the estimated speed, capped a little past
 * the expected next fix, and any disagreement with a new fix eases out instead
 * of jumping.
 */
import type { LngLat } from '@/domain'
import { angleDelta, snapToPath, wrap360 } from './geo'

/** One position reading, from any source. */
export interface RawFix {
  lngLat: LngLat
  accuracyM: number
  speedMps?: number
  /** GPS course over ground, degrees from north. */
  courseDeg?: number
  /** Receipt time, ms, on the same clock the tracker is sampled with. */
  t: number
}

export interface TrackerOptions {
  path: LngLat[]
  cum: number[]
  /** Once tracking, fixes worse than this are dropped. */
  maxAccuracyM?: number
  /** A fix implying a faster move along the route than this is an outlier. */
  maxSpeedMps?: number
  /** After this many outliers in a row, trust the new position (we really moved). */
  maxRejectsInRow?: number
  /** Time constant for easing out a disagreement with a new fix, seconds. */
  correctionTauS?: number
  /** Off: no dead reckoning and no easing; the state just updates per fix (reduced motion). */
  predict?: boolean
}

export interface TrackerState {
  fixes: number
  rejectsInRow: number
  /** Filtered along-route distance at `baseT`. */
  baseM: number
  baseT: number
  /** Residual from the last correction; decays to 0. */
  corrM: number
  speedMps: number
  /** Running estimate of the time between fixes, seconds. */
  intervalS: number
  lastMeasuredM: number
  lastFixT: number
  offRouteM: number
  courseDeg?: number
}

export const initialTracker: TrackerState = {
  fixes: 0,
  rejectsInRow: 0,
  baseM: 0,
  baseT: 0,
  corrM: 0,
  speedMps: 0,
  intervalS: 1,
  lastMeasuredM: 0,
  lastFixT: 0,
  offRouteM: 0,
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const total = (o: TrackerOptions) => o.cum[o.cum.length - 1] ?? 0

/** Weight of a new fix against the prediction: a 5 m fix is trusted fully, a 40 m fix a quarter. */
export const fixGain = (accuracyM: number) => clamp(8 / Math.max(accuracyM, 1), 0.25, 1)

/** Along-route distance to show at time `t`. */
export function predictAlong(s: TrackerState, t: number, o: TrackerOptions): number {
  if (s.fixes === 0) return 0
  if (o.predict === false) return clamp(s.baseM, 0, total(o))
  const dt = Math.max(0, (t - s.baseT) / 1000)
  // Do not run far past where the next fix is expected: stop at 1.25 intervals (0.5 to 5 s).
  const horizon = clamp(1.25 * s.intervalS, 0.5, 5)
  const ahead = s.speedMps * Math.min(dt, horizon)
  const corr = s.corrM * Math.exp(-dt / (o.correctionTauS ?? 0.8))
  return clamp(s.baseM + ahead + corr, 0, total(o))
}

export interface Ingested {
  state: TrackerState
  accepted: boolean
}

export function ingestFix(s: TrackerState, fix: RawFix, o: TrackerOptions): Ingested {
  const maxAcc = o.maxAccuracyM ?? 50
  const maxSpeed = o.maxSpeedMps ?? 20
  const shown = predictAlong(s, fix.t, o)
  const snap = snapToPath(o.path, o.cum, fix.lngLat, s.fixes ? { nearM: shown } : {})
  const measured = snap.alongM
  const course = Number.isFinite(fix.courseDeg) ? wrap360(fix.courseDeg!) : undefined

  if (s.fixes === 0) {
    return {
      accepted: true,
      state: {
        ...s,
        fixes: 1,
        baseM: measured,
        baseT: fix.t,
        corrM: 0,
        speedMps: clamp(fix.speedMps ?? 0, 0, maxSpeed),
        lastMeasuredM: measured,
        lastFixT: fix.t,
        offRouteM: snap.offRouteM,
        courseDeg: course,
      },
    }
  }

  const dt = Math.max(0.1, (fix.t - s.lastFixT) / 1000)
  const implied = Math.abs(measured - s.lastMeasuredM) / dt
  const outlier = fix.accuracyM > maxAcc || implied > maxSpeed
  if (outlier && s.rejectsInRow + 1 < (o.maxRejectsInRow ?? 3)) {
    return { accepted: false, state: { ...s, rejectsInRow: s.rejectsInRow + 1 } }
  }

  // Outliers that keep agreeing with each other re-anchor on the measurement.
  const target = outlier ? measured : shown + fixGain(fix.accuracyM) * (measured - shown)
  // Speed along the route: blend the observed rate with the device's own speed when it has one.
  const observed = Number.isFinite(fix.speedMps) ? (fix.speedMps! + Math.max(0, (measured - s.lastMeasuredM) / dt)) / 2 : (measured - s.lastMeasuredM) / dt
  const speedMps = clamp(s.speedMps + 0.4 * (observed - s.speedMps), 0, maxSpeed)

  return {
    accepted: true,
    state: {
      fixes: s.fixes + 1,
      rejectsInRow: 0,
      baseM: target,
      baseT: fix.t,
      // The shown position stays continuous: the gap to the new estimate is eased out.
      corrM: o.predict === false ? 0 : shown - target,
      speedMps,
      intervalS: s.intervalS + 0.3 * (Math.min(dt, 30) - s.intervalS),
      lastMeasuredM: measured,
      lastFixT: fix.t,
      offRouteM: snap.offRouteM,
      courseDeg: course,
    },
  }
}

/** Exponential low-pass on a compass angle, taking the short way round 0/360. */
export function lowPassAngle(prev: number, next: number, dtS: number, tauS = 0.35): number {
  const alpha = tauS <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dtS) / tauS)
  return wrap360(prev + angleDelta(prev, next) * alpha)
}

export interface HeadingInputs {
  /** Latest device compass reading and when it arrived (ms). */
  compass?: { deg: number; t: number }
  courseDeg?: number
  speedMps: number
  routeBearingDeg: number
  now: number
}

/** Device compass while it is live, else GPS course when moving, else the route's own direction. */
export function chooseHeading(h: HeadingInputs, compassStaleMs = 1500, movingMps = 0.8): number {
  if (h.compass && h.now - h.compass.t <= compassStaleMs) return h.compass.deg
  if (h.courseDeg !== undefined && h.speedMps >= movingMps) return h.courseDeg
  return h.routeBearingDeg
}
