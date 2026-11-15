import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEMO_DEFAULT_START, parseDemoParam, resolveDemoMode } from './demoMode'

describe('parseDemoParam', () => {
  it('is undecided when the URL has no demo param', () => {
    expect(parseDemoParam(null)).toBeUndefined()
  })

  it('turns on at Tommy Trojan for a bare ?demo', () => {
    expect(parseDemoParam('')).toEqual({ start: DEMO_DEFAULT_START })
    expect(parseDemoParam('1')).toEqual({ start: DEMO_DEFAULT_START })
  })

  it('takes a lat,lng start and stores it as [lng, lat]', () => {
    expect(parseDemoParam('34.0224,-118.2851')).toEqual({ start: [-118.2851, 34.0224] })
    expect(parseDemoParam(' 34.02 , -118.28 ')).toEqual({ start: [-118.28, 34.02] })
  })

  it('falls back to the default start for coordinates out of range', () => {
    expect(parseDemoParam('134,-118')).toEqual({ start: DEMO_DEFAULT_START })
  })

  it('turns off', () => {
    expect(parseDemoParam('off')).toBeNull()
    expect(parseDemoParam('false')).toBeNull()
    expect(parseDemoParam('0')).toBeNull()
  })
})

describe('resolveDemoMode', () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => sessionStorage.clear())

  it('remembers demo mode for the tab after the query string is gone', () => {
    expect(resolveDemoMode('?demo=34.03,-118.29')).toEqual({ start: [-118.29, 34.03] })
    expect(resolveDemoMode('')).toEqual({ start: [-118.29, 34.03] })
  })

  it('forgets it with ?demo=off', () => {
    resolveDemoMode('?demo')
    expect(resolveDemoMode('?demo=off')).toBeNull()
    expect(resolveDemoMode('')).toBeNull()
  })

  it('is off by default', () => {
    expect(resolveDemoMode('?q=coffee')).toBeNull()
  })

  it('still works for the page load when storage is blocked', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(resolveDemoMode('?demo')).toEqual({ start: DEMO_DEFAULT_START })
    spy.mockRestore()
  })
})

describe('location in demo mode', () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock('@/lib/demoMode')
  })

  it('reports the demo point as a granted fix without asking the browser', async () => {
    vi.doMock('@/lib/demoMode', () => ({ demoMode: { start: [-118.2856, 34.0206] } }))
    const watch = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, geolocation: { watchPosition: watch, clearWatch: vi.fn() } })
    const loc = await import('./geo/location')
    await loc.initLocation()
    expect(loc.getLocation()).toMatchObject({ status: 'granted', fix: { lngLat: [-118.2856, 34.0206] } })
    expect(await loc.requestLocation()).toMatchObject({ lngLat: [-118.2856, 34.0206] })
    loc.setDemoPosition([-118.28, 34.025])
    expect(loc.getLocation().fix?.lngLat).toEqual([-118.28, 34.025])
    expect(watch).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
