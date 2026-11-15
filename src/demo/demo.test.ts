import { describe, expect, it } from 'vitest'
import { SAFETY_HEAT_LAYER, buildings, demoLayerDefaults, demoLayers, demoRoutes, demoSearch, project, rooms, unproject } from '.'
import { demoRiskCells } from './heat'

describe('demo data', () => {
  it('project and unproject round trip', () => {
    const [x, y] = project(unproject(700, 520))
    expect(x).toBeCloseTo(700, 6)
    expect(y).toBeCloseTo(520, 6)
  })

  it('every room points at a real building', () => {
    const ids = new Set(buildings.map((b) => b.id))
    expect(rooms.every((r) => ids.has(r.buildingId))).toBe(true)
  })

  it('search matches names, codes and categories', () => {
    expect(demoSearch('dml', null).some((r) => r.id === 'b-lib')).toBe(true)
    expect(demoSearch('maker', null).some((r) => r.kind === 'room')).toBe(true)
    expect(demoSearch('', 'parking').every((r) => r.kind !== 'room')).toBe(true)
    expect(demoSearch('zzz', null)).toEqual([])
  })

  it('layer defaults come from the one layer list', () => {
    expect(demoLayers.some((l) => l.id === SAFETY_HEAT_LAYER)).toBe(true)
    for (const l of demoLayers) expect(demoLayerDefaults[l.id]).toBe(l.defaultOn)
  })

  it('returns a fastest and a safest route, slower on foot than by bike', () => {
    const walk = demoRoutes('b-eng', 'walk')
    const bike = demoRoutes('b-eng', 'bike')
    expect(walk.map((r) => r.kind).sort()).toEqual(['fastest', 'safest'])
    expect(walk[0]!.durationS).toBeGreaterThan(bike[0]!.durationS)
    expect(demoRoutes('nope', 'walk')).toEqual([])
  })

  it('demo heat is H3 cells with scores in 0..1 and closed rings', () => {
    const cells = demoRiskCells()
    expect(cells.length).toBeGreaterThan(100)
    expect(cells.every((c) => c.score >= 0 && c.score <= 1)).toBe(true)
    expect(cells.some((c) => c.score > 0.6)).toBe(true)
    expect(cells[0]!.boundary.at(0)).toEqual(cells[0]!.boundary.at(-1))
  })
})
