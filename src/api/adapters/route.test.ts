import { describe, expect, it } from 'vitest'
import { ApiError } from '@/api/client'
import { parseRoutes, routeErrorMessage } from './route'

const line = (pts: [number, number][]) => ({ type: 'LineString', coordinates: pts })
const safe = {
  geometry: line([
    [-118.2851, 34.0224],
    [-118.2851, 34.0214],
    [-118.2871, 34.0214],
  ]),
  length_m: 296,
  mean_risk: 0.2,
  max_risk: 0.4,
  high_risk_m: 0,
  no_data_pct: 0,
  n_phones: 2,
  label: 'safe',
}
const shortest = {
  geometry: line([
    [-118.2851, 34.0224],
    [-118.2871, 34.0214],
  ]),
  length_m: 216,
  mean_risk: 0.6,
  max_risk: 0.9,
  high_risk_m: 120,
  no_data_pct: 40,
  n_phones: 0,
}

describe('route adapter', () => {
  it('maps the backend plan to domain routes, fastest first', () => {
    const [fastest, safest] = parseRoutes({ safe, shortest, date: '2026-11-14' })
    expect(fastest).toMatchObject({ id: 'route-fastest', kind: 'fastest', distanceM: 216, risk: { mean: 0.6, max: 0.9 } })
    expect(fastest!.durationS).toBe(160)
    expect(fastest!.warnings).toHaveLength(2)
    expect(safest).toMatchObject({ id: 'route-safest', kind: 'safest', highlights: ['Passes 2 emergency phones'], warnings: [] })
    expect(safest!.path[0]).toEqual([-118.2851, 34.0224])
    expect(safest!.steps.map((s) => s.maneuver)).toEqual(['depart', 'right', 'arrive'])
    expect(safest!.segments).toEqual([{ path: safest!.path, score: 0.2 }])
  })
  it('returns one route when both plans are the same line', () => {
    expect(parseRoutes({ safe, shortest: { ...shortest, geometry: safe.geometry } }).map((r) => r.kind)).toEqual(['safest'])
  })
  it('rejects a body that is not a plan', () => {
    expect(() => parseRoutes({ safe })).toThrow()
  })
  it('passes on the backend reason for a 400', () => {
    expect(routeErrorMessage(new ApiError(400, '/x', undefined, 'start and end are 19.8 km apart; the limit is 12 km'))).toBe(
      'Start and end are 19.8 km apart; the limit is 12 km',
    )
    expect(routeErrorMessage(new ApiError(503, '/x'))).toMatch(/starting up/)
    expect(routeErrorMessage(new Error('x'))).toMatch(/not available/)
  })
})
