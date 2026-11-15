import { describe, expect, it } from 'vitest'
import type { LngLat } from '@/domain'
import { distanceM } from '../routeLine'
import { characterFeatures, characterFor, characters, lerpAngle, metresPerPx, placeRing } from '.'

const AT: LngLat = [-118.285, 34.02]
const M_PER_DEG = 111_320
/** Local metres (east, north) of a placed point relative to AT. */
const local = (p: LngLat) => [(p[0] - AT[0]) * M_PER_DEG * Math.cos((AT[1] * Math.PI) / 180), (p[1] - AT[1]) * M_PER_DEG]
const colors = { body: '#b', accent: '#a' }

describe('placeRing', () => {
  it('heading 0 points forward = north, ring closed', () => {
    const r = placeRing([[0, 10], [5, 0], [-5, 0]], AT, 0, 1)
    expect(r).toHaveLength(4)
    expect(r[3]).toEqual(r[0])
    const [e, n] = local(r[0]!)
    expect(e).toBeCloseTo(0, 6)
    expect(n).toBeCloseTo(10, 6)
  })

  it('rotates clockwise: heading 90 points east, 180 south', () => {
    const [e90, n90] = local(placeRing([[0, 10]], AT, 90, 1)[0]!)
    expect(e90).toBeCloseTo(10, 6)
    expect(n90).toBeCloseTo(0, 6)
    const [e180, n180] = local(placeRing([[0, 10]], AT, 180, 1)[0]!)
    expect(e180).toBeCloseTo(0, 6)
    expect(n180).toBeCloseTo(-10, 6)
    // +x (right of travel) at heading 90 is south.
    const [, nRight] = local(placeRing([[4, 0]], AT, 90, 1)[0]!)
    expect(nRight).toBeCloseTo(-4, 6)
  })

  it('scales design px by metres per unit', () => {
    const r = placeRing([[0, 10]], AT, 0, 2.5)
    expect(distanceM(AT, r[0]!)).toBeCloseTo(25, 3)
  })
})

describe('characters', () => {
  it('metres per px halves per zoom level and shrinks with latitude', () => {
    expect(metresPerPx(0, 0)).toBeCloseTo(78_271.5, 0)
    expect(metresPerPx(34, 17) / metresPerPx(34, 18)).toBeCloseTo(2, 9)
    expect(metresPerPx(60, 10)).toBeCloseTo(metresPerPx(0, 10) / 2, 6)
  })

  it('constant on-screen size: footprint in metres follows metres per px', () => {
    const size = (zoom: number) => {
      const ring = characterFeatures(characterFor('chevron'), { at: AT, headingDeg: 0 }, { zoom, mode: '2d' }, colors).features[0]!.geometry.coordinates[0]!
      return distanceM(ring[0] as LngLat, ring[2] as LngLat) / metresPerPx(AT[1], zoom)
    }
    expect(size(15)).toBeCloseTo(size(18), 6)
    expect(size(17)).toBeCloseTo(20, 6) // tip (0,15) to notch (0,-5)
  })

  it('flat in 2D, extruded with thickness in Iso, taller with a raised spine in 3D', () => {
    const view = (mode: '2d' | 'iso' | '3d') => characterFeatures(characterFor('chevron'), { at: AT, headingDeg: 30 }, { zoom: 17, mode }, colors).features
    const flat = view('2d')
    expect(flat.every((f) => !f.properties.solid && f.properties.height === 0)).toBe(true)
    const iso = view('iso')
    expect(iso.every((f) => f.properties.solid && f.properties.height > 0)).toBe(true)
    const solid = view('3d')
    const maxH = (fs: typeof solid) => Math.max(...fs.map((f) => f.properties.height))
    expect(maxH(solid)).toBeGreaterThan(maxH(iso))
    expect(solid.some((f) => f.properties.base > 0 && f.properties.color === '#a')).toBe(true)
    expect(flat[0]!.properties.outline).toBe(true)
  })

  it('registry: unknown ids and model characters fall back to the chevron', () => {
    expect(characterFor('nope').id).toBe('chevron')
    characters.ghost = { kind: 'model', id: 'ghost', label: 'Ghost', url: '/models/ghost.glb', scale: 1, flat: [] }
    expect(characterFor('ghost').id).toBe('chevron')
    delete characters.ghost
  })

  it('heading interpolation takes the short way round', () => {
    expect(lerpAngle(350, 10, 0.5)).toBeCloseTo(0, 9)
    expect(lerpAngle(10, 350, 0.25)).toBeCloseTo(5, 9)
    expect(lerpAngle(90, 180, 0.5)).toBeCloseTo(135, 9)
  })
})
