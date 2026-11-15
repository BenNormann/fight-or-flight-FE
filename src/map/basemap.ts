/**
 * The only place that knows where map tiles come from.
 * Turns a BasemapConfig (from the backend config, or the env override) into
 * something MapLibre accepts. Never hard-code tile URLs anywhere else.
 */
import type { StyleSpecification } from 'maplibre-gl'
import type { BasemapConfig } from '@/domain'

export type MapTheme = 'light' | 'dark'

/** Free public vector styles (OpenFreeMap), dev and mocks only. Production basemap comes from config. */
export const OPENFREEMAP_STYLES: Record<MapTheme, string> = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
}
export const DEV_FALLBACK_STYLE = OPENFREEMAP_STYLES.light

/** Interpret a bare URL (env override or a loosely specified backend field). */
export function basemapFromUrl(url: string): BasemapConfig {
  if (/\.pmtiles(\?|$)/.test(url) || url.startsWith('pmtiles://')) return { kind: 'pmtiles', url }
  if (url.includes('{z}')) {
    return /\.(pbf|mvt)(\?|$)/.test(url) ? { kind: 'vector', tiles: [url] } : { kind: 'raster', tiles: [url] }
  }
  return { kind: 'style', url }
}

/**
 * A style URL that is one of the themed OpenFreeMap pair follows the app
 * theme. Anything else (backend style, `VITE_MAP_STYLE_URL`) is used as is,
 * pass `themed: false` to force that.
 */
export function buildMapStyle(basemap: BasemapConfig, theme: MapTheme = 'light', themed = true): string | StyleSpecification {
  switch (basemap.kind) {
    case 'style':
      return themed && Object.values(OPENFREEMAP_STYLES).includes(basemap.url) ? OPENFREEMAP_STYLES[theme] : basemap.url
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
      // TODO(map lane): a themed style for raw vector / PMTiles basemaps. Until then, the public style.
      return OPENFREEMAP_STYLES[theme]
  }
}
