import { describe, expect, it } from 'vitest'
import { buildings, demoRoutes, demoSearch, project, rooms, unproject } from '.'

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
    expect(demoSearch('hol', null).some((r) => r.id === 'b-lib')).toBe(true)
    expect(demoSearch('maker', null).some((r) => r.kind === 'room')).toBe(true)
    expect(demoSearch('', 'parking').every((r) => r.kind !== 'room')).toBe(true)
    expect(demoSearch('zzz', null)).toEqual([])
  })

  it('returns a fastest and a safest route, slower on foot than by bike', () => {
    const walk = demoRoutes('b-eng', 'walk')
    const bike = demoRoutes('b-eng', 'bike')
    expect(walk.map((r) => r.kind).sort()).toEqual(['fastest', 'safest'])
    expect(walk[0]!.durationS).toBeGreaterThan(bike[0]!.durationS)
    expect(demoRoutes('nope', 'walk')).toEqual([])
  })
})
