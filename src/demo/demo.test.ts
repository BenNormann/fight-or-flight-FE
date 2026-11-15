import { describe, expect, it } from 'vitest'
import { SAFETY_HEAT_LAYER, buildings, demoLayerDefaults, demoLayers, demoRoutes, demoSearch, project, rooms, unproject } from '.'
import { maneuverFor, stepsFromPath } from '@/lib/nav/steps'
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

  it('routes carry turn by turn steps derived from their path', () => {
    const safest = demoRoutes('b-eng', 'walk').find((r) => r.kind === 'safest')!
    // North on Trousdale, left (west) onto Childs Way, right up to the entrance, arrive.
    expect(safest.steps.map((s) => s.maneuver)).toEqual(['depart', 'left', 'right', 'arrive'])
    expect(safest.steps[0]).toMatchObject({ offsetM: 0, name: 'Trousdale Pkwy' })
    expect(safest.steps[1]!.name).toBe('Childs Way')
    const last = safest.steps.at(-1)!
    expect(Math.abs(last.offsetM - safest.distanceM)).toBeLessThan(3)
    // Legs add up to the route and offsets increase.
    expect(safest.steps.reduce((m, s) => m + s.distanceM, 0)).toBe(last.offsetM)
    for (let i = 1; i < safest.steps.length; i++) expect(safest.steps[i]!.offsetM).toBeGreaterThan(safest.steps[i - 1]!.offsetM)
  })

  it('turn angles map to maneuvers and zero length legs are dropped', () => {
    expect([5, -30, 90, -150, 178].map(maneuverFor)).toEqual(['straight', 'slight-left', 'right', 'sharp-left', 'u-turn'])
    const p = unproject(800, 800)
    const steps = stepsFromPath([p, p, unproject(800, 700), unproject(800, 600)], ['A', 'A', 'B'])
    expect(steps.map((s) => s.maneuver)).toEqual(['depart', 'straight', 'arrive'])
    expect(steps[1]!.name).toBe('B')
  })

  it('demo heat is H3 cells with scores in 0..1 and closed rings', () => {
    const cells = demoRiskCells()
    expect(cells.length).toBeGreaterThan(100)
    expect(cells.every((c) => c.score >= 0 && c.score <= 1)).toBe(true)
    expect(cells.some((c) => c.score > 0.6)).toBe(true)
    expect(cells[0]!.boundary.at(0)).toEqual(cells[0]!.boundary.at(-1))
  })
})
