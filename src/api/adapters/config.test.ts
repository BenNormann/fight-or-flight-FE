import { describe, expect, it } from 'vitest'
import configFixture from '@/api/mocks/fixtures/config.json'
import { parseConfig } from './config'

describe('config adapter', () => {
  it('converts the proposed-contract fixture', () => {
    const config = parseConfig(configFixture)
    expect(config.capabilities.buildings).toBe(true)
    expect(config.bounds.ride[0]).toBeLessThan(config.bounds.campus[0])
    expect(config.basemap.kind).toBe('style')
  })

  it('accepts a minimal backend: single bbox, feature list, bare tile URL', () => {
    const config = parseConfig({
      bounds: [-118.3, 34.0, -118.2, 34.1],
      features: ['risk'],
      tileUrl: 'https://tiles.test/{z}/{x}/{y}.png',
    })
    expect(config.bounds.walk).toEqual(config.bounds.campus)
    expect(config.capabilities).toMatchObject({ risk: true, routing: false, events: false })
    expect(config.basemap.kind).toBe('raster')
    expect(config.center[0]).toBeCloseTo(-118.25)
  })

  it('turns everything off when no features are advertised', () => {
    const config = parseConfig({ bounds: [-1, -1, 1, 1] })
    expect(Object.values(config.capabilities).every((v) => v === false)).toBe(true)
  })

  it('rejects a response without bounds', () => {
    expect(() => parseConfig({ features: [] })).toThrow()
  })
})
