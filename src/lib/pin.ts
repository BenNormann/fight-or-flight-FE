import type { Id, LngLat } from '@/domain'

/**
 * A point picked on the map, as an id: `pin:<lat>,<lng>` (5 decimals, about 1 m).
 * It needs no lookup, so it survives a reload and a shared link.
 */
const PREFIX = 'pin:'

export function pinId([lng, lat]: LngLat): Id {
  return `${PREFIX}${lat.toFixed(5)},${lng.toFixed(5)}`
}

export function parsePin(id: Id | null | undefined): LngLat | null {
  if (!id?.startsWith(PREFIX)) return null
  const [lat, lng, ...rest] = id.slice(PREFIX.length).split(',').map(Number)
  if (rest.length || lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return [lng, lat]
}
