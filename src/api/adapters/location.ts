/** Live location adapter (PROPOSED contract): POST /api/v1/location while signed in. */
import { z } from 'zod'
import { apiFetch } from '@/api/client'
import type { LocationFix } from '@/domain'

export const LOCATION_PATH = '/api/v1/location'

/**
 * The body the backend expects. Also used by the mock handler to validate requests.
 * Strict: direction stays on the device, so a body carrying `heading_deg` (or anything else) is rejected.
 */
export const locationBody = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy_m: z.number().nonnegative(),
    speed_mps: z.number().optional(),
    ts: z.string(),
  })
  .strict()
export type LocationBody = z.infer<typeof locationBody>

/** `fix.headingDeg` is never sent: heading is used on the device only. */
export function toLocationBody(fix: LocationFix): LocationBody {
  const [lng, lat] = fix.lngLat
  return locationBody.parse({
    lat,
    lng,
    accuracy_m: fix.accuracyM,
    ...(fix.speedMps != null && Number.isFinite(fix.speedMps) ? { speed_mps: fix.speedMps } : {}),
    ts: fix.at,
  })
}

export async function postLocation(fix: LocationFix): Promise<void> {
  await apiFetch(LOCATION_PATH, { body: toLocationBody(fix) })
}
