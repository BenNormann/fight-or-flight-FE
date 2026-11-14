import { describe, expect, it } from 'vitest'
import { pathFor } from './urlSync'

describe('pathFor', () => {
  it('maps building, room and directions states to routes', () => {
    expect(pathFor({ view: 'place', selection: { kind: 'building', id: 'b-lib' }, destination: null })).toBe('/b/b-lib')
    expect(pathFor({ view: 'place', selection: { kind: 'room', id: 'r-3' }, destination: null })).toBe('/r/r-3')
    expect(pathFor({ view: 'directions', selection: null, destination: 'b-eng' })).toBe('/route?to=b-eng')
    expect(pathFor({ view: 'directions', selection: null, destination: null })).toBe('/route')
  })

  it('keeps sheet states (search, events, layers, safety) at /', () => {
    for (const view of ['explore', 'search', 'events', 'layers', 'safety'] as const)
      expect(pathFor({ view, selection: null, destination: null })).toBe('/')
    expect(pathFor({ view: 'place', selection: { kind: 'poi', id: 'p-dps' }, destination: null })).toBe('/')
  })
})
