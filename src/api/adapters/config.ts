/**
 * Config adapter: GET /api/config → AppConfig.
 * Pattern for every adapter: fetch → Zod-validate the backend shape → convert to domain types.
 * Be liberal in what is accepted; the domain type is the strict side.
 */
import { z } from 'zod'
import { apiFetch, ApiError } from '@/api/client'
import {
  CAPABILITY_KEYS,
  type AppConfig,
  type BBox,
  type BasemapConfig,
  type Capabilities,
} from '@/domain'
import { env } from '@/lib/env'
import { basemapFromUrl, DEV_FALLBACK_STYLE } from '@/map/basemap'

const bbox = z.tuple([z.number(), z.number(), z.number(), z.number()])
const lngLat = z.tuple([z.number(), z.number()])

const basemapObject = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('style'), url: z.string() }),
  z.object({ kind: z.literal('vector'), tiles: z.array(z.string()).min(1), minZoom: z.number().optional(), maxZoom: z.number().optional(), attribution: z.string().optional() }),
  z.object({ kind: z.literal('raster'), tiles: z.array(z.string()).min(1), tileSize: z.number().optional(), maxZoom: z.number().optional(), attribution: z.string().optional() }),
  z.object({ kind: z.literal('pmtiles'), url: z.string(), attribution: z.string().optional() }),
])

/** What the backend may send. Loose on purpose. */
const backendConfig = z.looseObject({
  bounds: z.union([bbox, z.looseObject({ campus: bbox, walk: bbox.optional(), ride: bbox.optional() })]),
  center: lngLat.optional(),
  basemap: z.union([basemapObject, z.string()]).optional(),
  styleUrl: z.string().optional(),
  tileUrl: z.string().optional(),
  features: z.union([z.array(z.string()), z.record(z.string(), z.boolean())]).optional(),
  riskResolutions: z.array(z.number().int()).optional(),
  dataUpdatedAt: z.string().optional(),
})

function toCapabilities(features: string[] | Record<string, boolean> | undefined): Capabilities {
  const on = (key: string) => (Array.isArray(features) ? features.includes(key) : features?.[key] === true)
  return Object.fromEntries(CAPABILITY_KEYS.map((k) => [k, on(k)])) as Capabilities
}

export function parseConfig(raw: unknown): AppConfig {
  const c = backendConfig.parse(raw)
  const campus: BBox = Array.isArray(c.bounds) ? c.bounds : c.bounds.campus
  const walk: BBox = (Array.isArray(c.bounds) ? undefined : c.bounds.walk) ?? campus
  const ride: BBox = (Array.isArray(c.bounds) ? undefined : c.bounds.ride) ?? walk

  const served = typeof c.basemap === 'object' ? c.basemap : (c.basemap ?? c.styleUrl ?? c.tileUrl)
  const basemap: BasemapConfig = env.mapStyleUrl
    ? basemapFromUrl(env.mapStyleUrl)
    : typeof served === 'string'
      ? basemapFromUrl(served)
      : (served ?? { kind: 'style', url: DEV_FALLBACK_STYLE })

  return {
    bounds: { campus, walk, ride },
    center: c.center ?? [(campus[0] + campus[2]) / 2, (campus[1] + campus[3]) / 2],
    basemap,
    capabilities: toCapabilities(c.features),
    riskResolutions: c.riskResolutions ?? [],
    dataUpdatedAt: c.dataUpdatedAt,
  }
}

/** USC University Park: the centre of the backend's study area. */
const USC: [number, number] = [-118.2851, 34.0224]

/**
 * What the hosted backend serves today (docs/BACKEND_CONTRACT.md). It has no config endpoint,
 * so this stands in for one. Each capability still switches itself off if its endpoint answers 404.
 */
export const LIVE_DEFAULT_CONFIG = {
  bounds: [USC[0] - 0.012, USC[1] - 0.008, USC[0] + 0.012, USC[1] + 0.008],
  center: USC,
  features: ['auth', 'routing', 'search'],
}

export async function fetchConfig(signal?: AbortSignal): Promise<AppConfig> {
  try {
    return parseConfig(await apiFetch('/api/config', { signal }))
  } catch (e) {
    if (e instanceof ApiError && e.notServed) return parseConfig(LIVE_DEFAULT_CONFIG)
    throw e
  }
}
