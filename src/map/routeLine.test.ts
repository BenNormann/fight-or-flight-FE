import { describe, expect, it } from 'vitest'
import type { LngLat, Route } from '@/domain'
import { navFeatures, routeFeatures, type RiskPalette } from './overlays'
import { aheadPieces, clip, cumulative, distanceM, lengthOf, pointAt, splitAt } from './routeLine'

// An L-shaped path near campus: ~100 m east, then ~100 m north.
const LAT = 34.02
const dLng = 100 / (111_320 * Math.cos((LAT * Math.PI) / 180))
const dLat = 100 / 111_320
const A: LngLat = [-118.285, LAT]
const B: LngLat = [A[0] + dLng, LAT]
const C: LngLat = [B[0], LAT + dLat]
const path = [A, B, C]

const near = (a: LngLat, b: LngLat) => distanceM(a, b) < 0.01

describe('route line geometry', () => {
  it('measures along the path', () => {
    expect(distanceM(A, B)).toBeCloseTo(100, 0)
    expect(cumulative(path).map(Math.round)).toEqual([0, 100, 200])
    expect(lengthOf(path)).toBeCloseTo(200, 0)
    expect(near(pointAt(path, 150), [B[0], LAT + dLat / 2])).toBe(true)
    expect(pointAt(path, -5)).toEqual(A)
    expect(pointAt(path, 999)).toEqual(C)
  })

  it('splits at progress: travelled + remaining meet at the split point', () => {
    const { done, ahead } = splitAt(path, 50)
    expect(done).toHaveLength(2)
    expect(ahead).toHaveLength(3)
    expect(near(done.at(-1)!, ahead[0]!)).toBe(true)
    expect(lengthOf(done)).toBeCloseTo(50, 0)
    expect(lengthOf(ahead)).toBeCloseTo(150, 0)
  })

  it('split at the ends leaves one side empty', () => {
    expect(splitAt(path, 0).done).toEqual([])
    expect(lengthOf(splitAt(path, 0).ahead)).toBeCloseTo(200, 0)
    expect(splitAt(path, 500).ahead).toEqual([])
  })

  it('clips a window and keeps inner vertices', () => {
    const w = clip(path, 50, 150)
    expect(w).toHaveLength(3)
    expect(w[1]).toEqual(B)
    expect(lengthOf(w)).toBeCloseTo(100, 0)
  })

  it('clips consecutive risk segments to what is ahead, keeping their data', () => {
    const segs = [
      { path: [A, B], score: 0.1 },
      { path: [B, C], score: 0.9 },
    ]
    expect(aheadPieces(segs, 0)).toHaveLength(2)
    const mid = aheadPieces(segs, 150)
    expect(mid).toHaveLength(1)
    expect(mid[0]!.score).toBe(0.9)
    expect(lengthOf(mid[0]!.path)).toBeCloseTo(50, 0)
    expect(aheadPieces(segs, 250)).toEqual([])
  })
})

const route: Route = {
  id: 'r',
  kind: 'safest',
  path,
  durationS: 150,
  distanceM: 200,
  risk: { mean: 0.5, max: 0.9 },
  segments: [
    { path: [A, B], score: 0.1 },
    { path: [B, C], score: 0.9 },
  ],
  warnings: [],
  steps: [
    { maneuver: 'depart', at: A, offsetM: 0, distanceM: 100 },
    { maneuver: 'left', at: B, offsetM: 100, distanceM: 100 },
    { maneuver: 'arrive', at: C, offsetM: 200, distanceM: 0 },
  ],
}
const palette: RiskPalette = ['#1', '#2', '#3', '#4', '#5']

describe('navigation features', () => {
  it('route line while navigating: dimmed travelled part, cased remaining part, risk colours kept', () => {
    const fc = routeFeatures({ chosen: route, others: [] }, palette, 150)
    const roles = fc.features.map((f) => f.properties.role)
    expect(roles).toEqual(['done', 'casing', 'segment'])
    expect(palette).toContain(fc.features[2]!.properties.color)
    // Preview (no progress): no travelled part.
    expect(routeFeatures({ chosen: route, others: [] }, palette).features.map((f) => f.properties.role)).toEqual(['casing', 'segment', 'segment'])
  })

  it('maneuver dots only ahead; destination always', () => {
    const before = navFeatures(route, 50).features
    expect(before.filter((f) => f.properties.role === 'step')).toHaveLength(1)
    expect(before.filter((f) => f.properties.role === 'destination')).toHaveLength(1)
    expect(before.some((f) => f.properties.role === 'ahead')).toBe(true)
    const after = navFeatures(route, 120).features
    expect(after.filter((f) => f.properties.role === 'step')).toHaveLength(0)
    expect(navFeatures(route, 200).features.map((f) => f.properties.role)).toEqual(['destination'])
  })
})
