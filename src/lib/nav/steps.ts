/**
 * Turn-by-turn steps from route geometry. Used for demo routes and for a backend
 * route that comes without steps (docs/BACKEND_CONTRACT.md): the line is the
 * backend's, the left / right wording is read off its shape.
 */
import type { LngLat, Maneuver, RouteStep } from '@/domain'
import { angleDelta, bearingDeg, distanceM, measure, toLocal } from './geo'

/** Turn type from the signed change of direction at a vertex (positive is right). */
export function maneuverFor(deltaDeg: number): Maneuver {
  const a = Math.abs(deltaDeg)
  const side = deltaDeg > 0 ? 'right' : 'left'
  if (a < 20) return 'straight'
  if (a < 45) return `slight-${side}` as const
  if (a < 135) return side
  if (a < 170) return `sharp-${side}` as const
  return 'u-turn'
}

/**
 * Turn-by-turn steps from a path and a street name per segment, the way a
 * router would return them: depart, one step per real turn (or per name change
 * on a straight), arrive. Zero-length segments are dropped first.
 */
export function stepsFromPath(path: LngLat[], legNames: (string | undefined)[]): RouteStep[] {
  const pts: LngLat[] = []
  const names: (string | undefined)[] = []
  path.forEach((p, i) => {
    const prev = pts[pts.length - 1]
    if (prev && distanceM(prev, p) < 0.5) return
    if (prev) names.push(legNames[i - 1])
    pts.push(p)
  })
  if (pts.length < 2) return []
  const cum = measure(pts)
  const steps: RouteStep[] = [{ maneuver: 'depart', at: pts[0]!, offsetM: 0, distanceM: 0, name: names[0] }]
  for (let i = 1; i < pts.length - 1; i++) {
    const turn = maneuverFor(angleDelta(bearingDeg(pts[i - 1]!, pts[i]!), bearingDeg(pts[i]!, pts[i + 1]!)))
    if (turn === 'straight' && names[i] === names[i - 1]) continue
    steps.push({ maneuver: turn, at: pts[i]!, offsetM: Math.round(cum[i]!), distanceM: 0, name: names[i] })
  }
  const total = Math.round(cum[cum.length - 1]!)
  steps.push({ maneuver: 'arrive', at: pts[pts.length - 1]!, offsetM: total, distanceM: 0 })
  // Each leg runs to the next maneuver.
  return steps.map((s, i) => ({ ...s, distanceM: i < steps.length - 1 ? steps[i + 1]!.offsetM - s.offsetM : 0 }))
}

/** Indices of the vertices kept by Douglas-Peucker at `toleranceM` (always the two ends). */
export function simplifyIndices(path: LngLat[], toleranceM: number): number[] {
  if (path.length < 3) return path.map((_, i) => i)
  const origin = path[0]!
  const pts = path.map((p) => toLocal(origin, p))
  const keep = new Set([0, path.length - 1])
  const stack: [number, number][] = [[0, path.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()!
    const [ax, ay] = pts[a]!
    const [bx, by] = pts[b]!
    const len = Math.hypot(bx - ax, by - ay)
    let worst = -1
    let worstD = toleranceM
    for (let i = a + 1; i < b; i++) {
      const [x, y] = pts[i]!
      const d = len ? Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / len : Math.hypot(x - ax, y - ay)
      if (d > worstD) {
        worst = i
        worstD = d
      }
    }
    if (worst > 0) {
      keep.add(worst)
      stack.push([a, worst], [worst, b])
    }
  }
  return [...keep].sort((x, y) => x - y)
}

/**
 * Steps for a real street path with no names: smooth out kinks (path wiggles, curved
 * walkways), then one step per remaining turn. Offsets are measured along the full path,
 * so they line up with navigation progress.
 */
export function stepsFromGeometry(path: LngLat[], toleranceM = 7, minLegM = 12): RouteStep[] {
  if (path.length < 2) return []
  const cum = measure(path)
  const total = Math.round(cum[cum.length - 1]!)
  const idx = simplifyIndices(path, toleranceM)
  const turns: RouteStep[] = []
  for (let k = 1; k < idx.length - 1; k++) {
    const [a, b, c] = [path[idx[k - 1]!]!, path[idx[k]!]!, path[idx[k + 1]!]!]
    const maneuver = maneuverFor(angleDelta(bearingDeg(a, b), bearingDeg(b, c)))
    const offsetM = Math.round(cum[idx[k]!]!)
    if (maneuver === 'straight' || offsetM < minLegM || total - offsetM < minLegM) continue
    // Two kinks a few metres apart are one turn to a walker: keep the first.
    const prev = turns[turns.length - 1]
    if (prev && offsetM - prev.offsetM < minLegM) continue
    turns.push({ maneuver, at: b, offsetM, distanceM: 0 })
  }
  const steps: RouteStep[] = [
    { maneuver: 'depart', at: path[0]!, offsetM: 0, distanceM: 0 },
    ...turns,
    { maneuver: 'arrive', at: path[path.length - 1]!, offsetM: total, distanceM: 0 },
  ]
  return steps.map((s, i) => ({ ...s, distanceM: i < steps.length - 1 ? steps[i + 1]!.offsetM - s.offsetM : 0 }))
}
