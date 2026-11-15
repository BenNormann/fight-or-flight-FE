import { describe, expect, it } from 'vitest'
import { OPENFREEMAP_STYLES, basemapFromUrl, buildMapStyle } from './basemap'

describe('basemap', () => {
  it('classifies a bare URL', () => {
    expect(basemapFromUrl('https://x.test/style.json').kind).toBe('style')
    expect(basemapFromUrl('https://x.test/campus.pmtiles').kind).toBe('pmtiles')
    expect(basemapFromUrl('https://x.test/{z}/{x}/{y}.png').kind).toBe('raster')
    expect(basemapFromUrl('https://x.test/{z}/{x}/{y}.pbf').kind).toBe('vector')
  })

  it('passes style URLs through and wraps raster tiles in a style', () => {
    expect(buildMapStyle({ kind: 'style', url: 'https://x.test/s.json' })).toBe('https://x.test/s.json')
    const style = buildMapStyle({ kind: 'raster', tiles: ['https://x.test/{z}/{x}/{y}.png'] })
    expect(typeof style).toBe('object')
  })

  it('swaps the public style with the theme, but never an override', () => {
    const light = { kind: 'style' as const, url: OPENFREEMAP_STYLES.light }
    expect(buildMapStyle(light, 'dark')).toBe(OPENFREEMAP_STYLES.dark)
    expect(buildMapStyle(light, 'light')).toBe(OPENFREEMAP_STYLES.light)
    expect(buildMapStyle(light, 'dark', false)).toBe(OPENFREEMAP_STYLES.light)
    expect(buildMapStyle({ kind: 'style', url: 'https://x.test/s.json' }, 'dark')).toBe('https://x.test/s.json')
  })
})
