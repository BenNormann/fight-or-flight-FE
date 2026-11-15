import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOCATION_PATH, postLocation, toLocationBody } from './location'

const fix = { lngLat: [-118.285, 34.022] as [number, number], accuracyM: 12, at: '2026-11-14T08:00:00.000Z' }

describe('location adapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('converts a fix to the backend body, omitting unknown heading and speed', () => {
    expect(toLocationBody(fix)).toEqual({ lat: 34.022, lng: -118.285, accuracy_m: 12, ts: fix.at })
    expect(toLocationBody({ ...fix, headingDeg: 90, speedMps: 1.4 })).toMatchObject({ heading_deg: 90, speed_mps: 1.4 })
    expect(toLocationBody({ ...fix, headingDeg: Number.NaN })).not.toHaveProperty('heading_deg')
  })

  it('rejects impossible coordinates', () => {
    expect(() => toLocationBody({ ...fix, lngLat: [0, 120] })).toThrow()
  })

  it('POSTs JSON with credentials and accepts 204', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(postLocation(fix)).resolves.toBeUndefined()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain(LOCATION_PATH)
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
  })
})
