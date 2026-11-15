/**
 * Demo mode adapter: simulated crimes for recordings (backend `/api/v1/demo/*`, only when the
 * backend runs with DEMO_MODE=true). The backend makes routes avoid an active one, so a walk
 * in progress reroutes after a re-plan.
 */
import { z } from 'zod'
import { apiFetch } from '@/api/client'
import type { DemoStatus, LngLat, SimulatedIncident } from '@/domain'

export const DEMO_PATHS = {
  status: '/api/v1/demo/status',
  incidents: '/api/v1/demo/incidents',
} as const

const backendStatus = z.object({
  enabled: z.boolean(),
  ttl_minutes: z.number(),
  avoid_radius_m: z.number(),
  categories: z.array(z.string()),
})

export const backendIncident = z.object({
  id: z.string(),
  ts: z.string(),
  lat: z.number(),
  lng: z.number(),
  category: z.string().nullable().optional(),
})
export type BackendDemoIncident = z.infer<typeof backendIncident>

const backendList = z.object({ incidents: z.array(backendIncident) })

export function toIncident(r: BackendDemoIncident): SimulatedIncident {
  return { id: r.id, lngLat: [r.lng, r.lat], category: r.category ?? 'Incident', at: r.ts }
}

export function parseStatus(raw: unknown): DemoStatus {
  const s = backendStatus.parse(raw)
  return { enabled: s.enabled, ttlMinutes: s.ttl_minutes, avoidRadiusM: s.avoid_radius_m, categories: s.categories }
}

export function parseIncidents(raw: unknown): SimulatedIncident[] {
  return backendList.parse(raw).incidents.map(toIncident)
}

export async function fetchDemoStatus(signal?: AbortSignal): Promise<DemoStatus> {
  return parseStatus(await apiFetch(DEMO_PATHS.status, { signal }))
}

export async function fetchDemoIncidents(signal?: AbortSignal): Promise<SimulatedIncident[]> {
  return parseIncidents(await apiFetch(DEMO_PATHS.incidents, { signal }))
}

export async function simulateIncident(at: LngLat, category?: string): Promise<SimulatedIncident> {
  const [lng, lat] = at
  return toIncident(backendIncident.parse(await apiFetch(DEMO_PATHS.incidents, { body: { lat, lng, ...(category ? { category } : {}) } })))
}

export async function clearIncidents(): Promise<void> {
  await apiFetch(DEMO_PATHS.incidents, { method: 'DELETE' })
}
