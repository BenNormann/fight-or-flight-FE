/**
 * Small-scale geometry for walking along a route. Equirectangular around each
 * segment: exact enough at campus scale (well under 0.1% over a few km). Pure.
 */
import type { LngLat } from '@/domain'

const M_PER_DEG_LAT = 111_320
const rad = (d: number) => (d * Math.PI) / 180

/** Local metres (east, north) of `p` relative to `origin`. */
export function toLocal(origin: LngLat, p: LngLat): [x: number, y: number] {
  const k = M_PER_DEG_LAT * Math.cos(rad(origin[1]))
  return [(p[0] - origin[0]) * k, (p[1] - origin[1]) * M_PER_DEG_LAT]
}

export function fromLocal(origin: LngLat, x: number, y: number): LngLat {
  const k = M_PER_DEG_LAT * Math.cos(rad(origin[1]))
  return [origin[0] + x / k, origin[1] + y / M_PER_DEG_LAT]
}

export function distanceM(a: LngLat, b: LngLat): number {
  const [x, y] = toLocal(a, b)
  return Math.hypot(x, y)
}

/** Degrees clockwise from north, 0 to 360. */
export function bearingDeg(a: LngLat, b: LngLat): number {
  const [x, y] = toLocal(a, b)
  return wrap360((Math.atan2(x, y) * 180) / Math.PI)
}

export const wrap360 = (deg: number) => ((deg % 360) + 360) % 360

/** Signed shortest turn from `from` to `to`, in (-180, 180]. Positive is clockwise (right). */
export function angleDelta(from: number, to: number): number {
  const d = wrap360(to - from)
  return d > 180 ? d - 360 : d
}

/** Distance from the start of `path` to each vertex. */
export function measure(path: LngLat[]): number[] {
  const out = [0]
  for (let i = 1; i < path.length; i++) out.push(out[i - 1]! + distanceM(path[i - 1]!, path[i]!))
  return out
}

export interface PathPoint {
  point: LngLat
  /** Bearing of the segment the point lies on. */
  bearingDeg: number
  /** Index of that segment's first vertex. */
  segment: number
}

/** The point `alongM` metres along `path` (clamped to its ends). `cum` is `measure(path)`. */
export function pointAlong(path: LngLat[], cum: number[], alongM: number): PathPoint {
  const n = path.length
  if (n === 0) return { point: [0, 0], bearingDeg: 0, segment: 0 }
  if (n === 1) return { point: path[0]!, bearingDeg: 0, segment: 0 }
  const total = cum[n - 1]!
  const d = Math.min(Math.max(alongM, 0), total)
  // Last segment whose start is at or before d, skipping zero-length segments for the bearing.
  let i = 0
  while (i < n - 2 && cum[i + 1]! <= d) i++
  const a = path[i]!
  const b = path[i + 1]!
  const len = cum[i + 1]! - cum[i]!
  const t = len > 0 ? (d - cum[i]!) / len : 0
  return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], bearingDeg: len > 0 ? bearingDeg(a, b) : 0, segment: i }
}

export interface Snap {
  point: LngLat
  alongM: number
  /** Distance from the position to the route. */
  offRouteM: number
  segment: number
}

function snapSegment(path: LngLat[], cum: number[], i: number, pos: LngLat): Snap {
  const a = path[i]!
  const b = path[i + 1]!
  const [bx, by] = toLocal(a, b)
  const [px, py] = toLocal(a, pos)
  const len2 = bx * bx + by * by
  const t = len2 > 0 ? Math.min(1, Math.max(0, (px * bx + py * by) / len2)) : 0
  const x = bx * t
  const y = by * t
  return {
    point: fromLocal(a, x, y),
    alongM: cum[i]! + t * (cum[i + 1]! - cum[i]!),
    offRouteM: Math.hypot(px - x, py - y),
    segment: i,
  }
}

export interface SnapOptions {
  /** Last known progress. With it, candidates near that progress win over a closer far part of the route (loops, out and back). */
  nearM?: number
  /** How far behind / ahead of `nearM` to look first. */
  behindM?: number
  aheadM?: number
  /** If nothing in the window is within this distance, search the whole route. */
  fallbackOffRouteM?: number
}

/** Nearest point on the route to `pos`. */
export function snapToPath(path: LngLat[], cum: number[], pos: LngLat, opts: SnapOptions = {}): Snap {
  if (path.length < 2) return { point: path[0] ?? pos, alongM: 0, offRouteM: path[0] ? distanceM(path[0], pos) : 0, segment: 0 }
  const { nearM, behindM = 30, aheadM = 150, fallbackOffRouteM = 40 } = opts
  let best: Snap | null = null
  let bestWindowed: Snap | null = null
  for (let i = 0; i < path.length - 1; i++) {
    const s = snapSegment(path, cum, i, pos)
    if (!best || s.offRouteM < best.offRouteM) best = s
    if (nearM !== undefined && cum[i + 1]! >= nearM - behindM && cum[i]! <= nearM + aheadM) {
      if (!bestWindowed || s.offRouteM < bestWindowed.offRouteM) bestWindowed = s
    }
  }
  if (bestWindowed && bestWindowed.offRouteM <= Math.max(fallbackOffRouteM, best!.offRouteM)) return bestWindowed
  return best!
}
