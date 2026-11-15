/**
 * Pure line geometry for the route while navigating: lengths along a path,
 * clipping a path to a distance window, and the travelled / remaining split.
 * Planar metres around the path (campus scale), no MapLibre import.
 */
import type { LngLat } from '@/domain'

const M_PER_DEG = 111_320

/** Distance in metres between two nearby points (equirectangular). */
export function distanceM(a: LngLat, b: LngLat): number {
  const k = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
  return Math.hypot((b[0] - a[0]) * k * M_PER_DEG, (b[1] - a[1]) * M_PER_DEG)
}

/** Cumulative distance at each vertex; first is 0, last is the path length. */
export function cumulative(path: LngLat[]): number[] {
  const out = [0]
  for (let i = 1; i < path.length; i++) out.push(out[i - 1]! + distanceM(path[i - 1]!, path[i]!))
  return out
}

export const lengthOf = (path: LngLat[]) => cumulative(path).at(-1) ?? 0

const lerp = (a: LngLat, b: LngLat, t: number): LngLat => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Point at `m` metres along the path (clamped to its ends). */
export function pointAt(path: LngLat[], m: number, cum = cumulative(path)): LngLat {
  if (!path.length) throw new Error('empty path')
  if (m <= 0) return path[0]!
  for (let i = 1; i < path.length; i++) {
    if (cum[i]! >= m) {
      const span = cum[i]! - cum[i - 1]!
      return span ? lerp(path[i - 1]!, path[i]!, (m - cum[i - 1]!) / span) : path[i]!
    }
  }
  return path.at(-1)!
}

/**
 * The part of `path` between `fromM` and `toM` metres along it, with
 * interpolated end points. Fewer than 2 points means nothing is left.
 */
export function clip(path: LngLat[], fromM: number, toM: number): LngLat[] {
  const cum = cumulative(path)
  const total = cum.at(-1) ?? 0
  const a = Math.max(0, fromM)
  const b = Math.min(total, toM)
  if (path.length < 2 || b - a <= 1e-6) return []
  const out: LngLat[] = [pointAt(path, a, cum)]
  for (let i = 1; i < path.length - 1; i++) if (cum[i]! > a && cum[i]! < b) out.push(path[i]!)
  out.push(pointAt(path, b, cum))
  return out
}

/** Travelled and remaining parts of a path at `progressM`. Either may be empty. */
export function splitAt(path: LngLat[], progressM: number): { done: LngLat[]; ahead: LngLat[] } {
  return { done: clip(path, 0, progressM), ahead: clip(path, progressM, Infinity) }
}

/**
 * Consecutive pieces (e.g. risk segments) clipped to what lies ahead of
 * `progressM`, keeping each piece's own data. Pieces are assumed to run end
 * to end along the route, so each one's offset is the sum of those before it.
 */
export function aheadPieces<T extends { path: LngLat[] }>(pieces: T[], progressM: number): T[] {
  const out: T[] = []
  let start = 0
  for (const p of pieces) {
    const len = lengthOf(p.path)
    const kept = clip(p.path, progressM - start, Infinity)
    if (kept.length >= 2) out.push({ ...p, path: kept })
    start += len
  }
  return out
}
