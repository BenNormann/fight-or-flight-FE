import { describe, expect, it } from 'vitest'
import type { LngLat } from '@/domain'
import { fromLocal } from './geo'
import { simplifyIndices, stepsFromGeometry } from './steps'

const O: LngLat = [-118.2851, 34.0224]
/** Local metres (x east, y north) to LngLat. */
const at = (x: number, y: number) => fromLocal(O, x, y)

describe('stepsFromGeometry', () => {
  it('ignores small wiggles and reports one step per real turn', () => {
    // North 100 m with a 2 m wobble, then east 80 m along a gently curving walkway.
    const path = [at(0, 0), at(1, 30), at(-1, 60), at(0, 100), at(30, 101), at(60, 99), at(80, 100)]
    const steps = stepsFromGeometry(path)
    expect(steps.map((s) => s.maneuver)).toEqual(['depart', 'right', 'arrive'])
    expect(steps[1]!.offsetM).toBeGreaterThan(95)
    expect(steps[1]!.offsetM).toBeLessThan(105)
    // Legs add up to the full path, so progress along the route matches the steps.
    expect(steps.reduce((m, s) => m + s.distanceM, 0)).toBe(steps.at(-1)!.offsetM)
  })
  it('merges two kinks a few metres apart into one turn', () => {
    const path = [at(0, 0), at(0, 100), at(6, 106), at(100, 106)]
    expect(stepsFromGeometry(path).filter((s) => s.maneuver !== 'depart' && s.maneuver !== 'arrive')).toHaveLength(1)
  })
  it('handles a straight line and a degenerate path', () => {
    expect(stepsFromGeometry([at(0, 0), at(0, 50)]).map((s) => s.maneuver)).toEqual(['depart', 'arrive'])
    expect(stepsFromGeometry([at(0, 0)])).toEqual([])
  })
  it('keeps the ends when simplifying', () => {
    expect(simplifyIndices([at(0, 0), at(0.5, 10), at(0, 20)], 5)).toEqual([0, 2])
  })
})
