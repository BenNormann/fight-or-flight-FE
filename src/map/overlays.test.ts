import { describe, expect, it } from 'vitest'
import { ORIGIN, demoRoutes } from '@/demo'
import { demoRiskCells } from '@/demo/heat'
import { fitPoints, heatFeatures, pinSpecs, routeFeatures, shownRoutes, type RiskPalette } from './overlays'

const palette: RiskPalette = ['#1', '#2', '#3', '#4', '#5']
const routes = demoRoutes('b-lib', 'walk')

describe('shownRoutes', () => {
  it('previews the chosen kind with the alternative, only in directions', () => {
    const s = shownRoutes(routes, { activeRouteId: null, directions: true, routeKind: 'safest' })
    expect(s.chosen?.kind).toBe('safest')
    expect(s.others.map((r) => r.kind)).toEqual(['fastest'])
    expect(shownRoutes(routes, { activeRouteId: null, directions: false, routeKind: 'safest' }).chosen).toBeNull()
  })
  it('a started route shows alone; an unknown id shows nothing', () => {
    const s = shownRoutes(routes, { activeRouteId: 'route-fastest', directions: false, routeKind: 'safest' })
    expect(s.chosen?.kind).toBe('fastest')
    expect(s.others).toEqual([])
    expect(shownRoutes(routes, { activeRouteId: 'gone', directions: true, routeKind: 'safest' }).chosen).toBeNull()
  })
})

describe('features', () => {
  it('route: alternatives, one casing, risk coloured segments with labels', () => {
    const fc = routeFeatures(shownRoutes(routes, { activeRouteId: null, directions: true, routeKind: 'fastest' }), palette)
    const roles = fc.features.map((f) => f.properties.role)
    expect(roles.filter((r) => r === 'casing')).toHaveLength(1)
    expect(roles.filter((r) => r === 'alt')).toHaveLength(1)
    const seg = fc.features.find((f) => f.properties.role === 'segment')!
    expect(palette).toContain(seg.properties.color)
    expect(seg.properties.label).toBeTruthy()
  })
  it('heat: one polygon per cell with a colour from the palette', () => {
    const cells = demoRiskCells()
    const fc = heatFeatures(cells, palette)
    expect(fc.features).toHaveLength(cells.length)
    expect(fc.features.every((f) => palette.includes(f.properties!.color as RiskPalette[number]))).toBe(true)
  })
})

describe('pins and fit', () => {
  it('toggles hide pins; the selected pin comes last', () => {
    const all = pinSpecs(ORIGIN, 'b-lib', () => true)
    const none = pinSpecs(ORIGIN, null, () => false)
    expect(all.length).toBeGreaterThan(none.length)
    expect(all.at(-1)!.key).toBe('b-lib')
    expect(none.some((p) => p.type === 'blue_light')).toBe(false)
  })
  it('frames the route over the selection', () => {
    const shown = shownRoutes(routes, { activeRouteId: null, directions: true, routeKind: 'safest' })
    expect(fitPoints(shown, { kind: 'building', id: 'b-lib' })!.kind).toBe('route')
    expect(fitPoints({ chosen: null, others: [] }, { kind: 'poi', id: 'p-dps' })!.points).toHaveLength(1)
    expect(fitPoints({ chosen: null, others: [] }, null)).toBeNull()
  })
})
