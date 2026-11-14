/**
 * The only place that knows where map tiles come from.
 * Turns a BasemapConfig (from the backend config, or the env override) into
 * something MapLibre accepts. Never hard-code tile URLs anywhere else.
 *
 * P0 covers style URLs and raster tiles. The map lane adds vector + PMTiles styling.
 */
import type { StyleSpecification } from 'maplibre-gl'
import type { BasemapConfig } from '@/domain'

/** Free public style for dev/mocks only. Production basemap comes from config. */
export const DEV_FALLBACK_STYLE = 'https://tiles.openfreemap.org/styles/positron'

/** Interpret a bare URL (env override or a loosely specified backend field). */
export function basemapFromUrl(url: string): BasemapConfig {
  if (/\.pmtiles(\?|$)/.test(url) || url.startsWith('pmtiles://')) return { kind: 'pmtiles', url }
  if (url.includes('{z}')) {
    return /\.(pbf|mvt)(\?|$)/.test(url) ? { kind: 'vector', tiles: [url] } : { kind: 'raster', tiles: [url] }
  }
  return { kind: 'style', url }
}

export function buildMapStyle(basemap: BasemapConfig): string | StyleSpecification {
  switch (basemap.kind) {
    case 'style':
      return basemap.url
    case 'raster':
      return {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: basemap.tiles,
            tileSize: basemap.tileSize ?? 256,
            maxzoom: basemap.maxZoom ?? 19,
            attribution: basemap.attribution ?? '',
          },
        },
        layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
      }
    case 'vector':
    case 'pmtiles':
      // TODO(map lane, P1): build a themed style for vector / PMTiles sources.
      return DEV_FALLBACK_STYLE
  }
}
