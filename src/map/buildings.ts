/**
 * Where extruded buildings come from. Backend `GET /api/v1/buildings.pmtiles`
 * (layer `buildings`, attribute `height_m`) when a backend is configured and
 * serving it; otherwise the basemap's own OpenMapTiles `building` layer.
 */
import type { ExpressionSpecification, StyleSpecification } from 'maplibre-gl'
import { env } from '@/lib/env'
import { BUILDINGS_EXTRUDE_ZOOM, BUILDINGS_FULL_HEIGHT_ZOOM } from './camera'

/** A height (or base) that is 0 at the extrusion threshold and full by {@link BUILDINGS_FULL_HEIGHT_ZOOM}. */
export function growWithZoom(height: ExpressionSpecification): ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], BUILDINGS_EXTRUDE_ZOOM, 0, BUILDINGS_FULL_HEIGHT_ZOOM, height]
}

export interface BuildingSource {
  /** Source id in the style; added by us for PMTiles, the basemap's own otherwise. */
  source: string
  sourceLayer: string
  height: ExpressionSpecification
  base: ExpressionSpecification
  /** For PMTiles: the source to add. */
  add?: { type: 'vector'; url: string }
}

export const BACKEND_BUILDINGS_PATH = '/api/v1/buildings.pmtiles'

/** Absolute URL of the backend buildings archive, or null in mock mode / without a backend. */
export function backendBuildingsUrl(base = env.tilesBase, origin = typeof location === 'undefined' ? 'http://localhost' : location.href): string | null {
  if (env.useMocks || !env.apiUrl) return null
  return new URL(`${base}${BACKEND_BUILDINGS_PATH}`, origin).href
}

let probe: Promise<boolean> | null = null
/** One small range request: the archive is 404 until the backend builds it. */
export function backendBuildingsAvailable(url: string): Promise<boolean> {
  probe ??= fetch(url, { headers: { Range: 'bytes=0-15' } })
    .then((r) => r.ok)
    .catch(() => false)
  return probe
}

export function pmtilesBuildings(url: string): BuildingSource {
  return {
    source: 'fof-buildings-pmtiles',
    sourceLayer: 'buildings',
    height: ['coalesce', ['get', 'height_m'], 4],
    base: ['literal', 0],
    add: { type: 'vector', url: `pmtiles://${url}` },
  }
}

/** The basemap's own building layer (OpenMapTiles schema), if the style has one. */
export function basemapBuildings(style: Pick<StyleSpecification, 'layers'>): BuildingSource | null {
  const layer = style.layers.find((l) => 'source-layer' in l && l['source-layer'] === 'building')
  if (!layer || !('source' in layer) || typeof layer.source !== 'string') return null
  return {
    source: layer.source,
    sourceLayer: 'building',
    height: ['coalesce', ['get', 'render_height'], ['get', 'height'], 6],
    base: ['coalesce', ['get', 'render_min_height'], 0],
  }
}
