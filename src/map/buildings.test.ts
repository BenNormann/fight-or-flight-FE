import { describe, expect, it } from 'vitest'
import { basemapBuildings, pmtilesBuildings } from './buildings'

describe('building sources', () => {
  it('PMTiles: backend layer and height_m', () => {
    const b = pmtilesBuildings('https://api.test/api/v1/buildings.pmtiles')
    expect(b.add?.url).toBe('pmtiles://https://api.test/api/v1/buildings.pmtiles')
    expect(b.sourceLayer).toBe('buildings')
    expect(JSON.stringify(b.height)).toContain('height_m')
  })

  it('falls back to the basemap building layer when present', () => {
    const style = {
      layers: [
        { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water' },
        { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building' },
      ],
    } as Parameters<typeof basemapBuildings>[0]
    expect(basemapBuildings(style)).toMatchObject({ source: 'openmaptiles', sourceLayer: 'building' })
    expect(basemapBuildings({ layers: [] })).toBeNull()
  })
})
