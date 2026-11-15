import { describe, expect, it } from 'vitest'
import { whereIs } from '@/app/useDemoIncidentWatcher'
import { demoIncidentFeatures } from '@/map/demoIncidents'
import { distanceM } from '@/lib/nav'
import { parseIncidents, parseStatus, toIncident } from './demo'

describe('demo adapter', () => {
  it('parses the backend status', () => {
    expect(parseStatus({ enabled: true, ttl_minutes: 60, avoid_radius_m: 120, categories: ['Robbery'] })).toEqual({
      enabled: true,
      ttlMinutes: 60,
      avoidRadiusM: 120,
      categories: ['Robbery'],
    })
  })

  it('maps incidents to [lng, lat] and fills a missing category', () => {
    const raw = { incidents: [{ id: 'a1', ts: '2026-11-15T17:34:00Z', lat: 34.03, lng: -118.28, h3_cell: 'x', severity: 1, category: null }] }
    expect(parseIncidents(raw)).toEqual([{ id: 'a1', lngLat: [-118.28, 34.03], category: 'Incident', at: '2026-11-15T17:34:00Z' }])
    expect(toIncident({ id: 'b', ts: 't', lat: 1, lng: 2, category: 'Assault' }).category).toBe('Assault')
  })

  it('rejects a malformed list', () => {
    expect(() => parseIncidents({ incidents: [{ id: 1 }] })).toThrow()
  })
})

describe('whereIs', () => {
  const here: [number, number] = [-118.285, 34.02]
  const north: [number, number] = [-118.285, 34.0213]   // ~145 m north

  it('says ahead or behind from the heading, and rounds to 10 m', () => {
    expect(whereIs(north, here, 0)).toBe('140 m ahead')
    expect(whereIs(north, here, 180)).toBe('140 m behind you')
    expect(whereIs(north, here, 90)).toBe('140 m away')
    expect(whereIs(north, here)).toBe('140 m away')
  })
})

describe('demoIncidentFeatures', () => {
  it('draws a closed ring at the avoid radius and a pin per incident', () => {
    const fc = demoIncidentFeatures([{ id: 'a', lngLat: [-118.285, 34.02], category: 'Robbery', at: 't' }], 120)
    expect(fc.features.map((f) => f.properties?.kind)).toEqual(['zone', 'pin'])
    const ring = (fc.features[0]!.geometry as GeoJSON.Polygon).coordinates[0]!
    expect(ring[0]).toEqual(ring[ring.length - 1])
    for (const p of ring) expect(distanceM([-118.285, 34.02], p as [number, number])).toBeCloseTo(120, -1)
  })
})
