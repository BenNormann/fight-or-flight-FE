import { describe, expect, it } from 'vitest'
import type { LngLat } from '@/domain'
import { floorHopFeatures, floorSpan, storeyHeight } from './floorHop'

const ring: LngLat[] = [
  [-118.2851, 34.0224],
  [-118.2849, 34.0224],
  [-118.2849, 34.0226],
  [-118.2851, 34.0226],
]
const at: LngLat = [-118.2852, 34.0223]

describe('floor hop', () => {
  it('places floors a storey apart, squeezing them under a low roof', () => {
    expect(floorSpan(1, 20)).toEqual({ base: 0, top: 4 })
    expect(floorSpan(3, 20)).toEqual({ base: 8, top: 12 })
    expect(storeyHeight(9, 3)).toBe(3)
    expect(floorSpan(3, 9)).toEqual({ base: 6, top: 9 })
    expect(floorSpan(0, 20)).toBeNull()
    expect(floorSpan(-1, 20)).toBeNull()
  })
  it('draws one band at the floor and one hop per storey climbed', () => {
    const f = floorHopFeatures(ring, 20, 3, at).features
    expect(f.map((x) => x.properties.role)).toEqual(['band', 'hop', 'hop'])
    expect(f[0]!.properties).toMatchObject({ base: 8, height: 12 })
    // Hops stay inside their own storey, with a gap between them.
    expect(f[1]!.properties.height).toBeLessThan(f[2]!.properties.base)
    expect(f[2]!.properties.height).toBeLessThan(8)
    // The band is closed and a little larger than the footprint.
    const band = f[0]!.geometry.coordinates[0]!
    expect(band[0]).toEqual(band.at(-1))
    expect(Math.min(...band.map((p) => p[0]!))).toBeLessThan(-118.2851)
  })
  it('has no hops for the entrance floor and nothing below ground', () => {
    expect(floorHopFeatures(ring, 20, 1, at).features.map((x) => x.properties.role)).toEqual(['band'])
    expect(floorHopFeatures(ring, 20, -1, at).features).toEqual([])
  })
})
