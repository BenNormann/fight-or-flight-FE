/**
 * Route adapter: GET /api/v1/route?from=lat,lng&to=lat,lng[&at=ISO] -> Route[].
 * The backend plans a `safe` and a `shortest` walking route (docs/BACKEND_CONTRACT.md).
 * It sends no travel time, no per-segment risk and no turn steps, so here:
 * time is distance at walking pace, the whole line carries the route's mean risk,
 * and steps are read off the line's shape (src/lib/nav/steps.ts).
 */
import { z } from 'zod'
import { apiFetch, ApiError } from '@/api/client'
import type { LngLat, Route, RouteKind, RouteRequest } from '@/domain'
import { stepsFromGeometry } from '@/lib/nav/steps'

export const ROUTE_PATH = '/api/v1/route'
/** Average walking pace; the backend returns distance only. */
export const WALK_MPS = 1.35

const backendRoute = z.looseObject({
  geometry: z.looseObject({ coordinates: z.array(z.tuple([z.number(), z.number()]).rest(z.number())).min(2) }),
  length_m: z.number(),
  mean_risk: z.number().nullish(),
  max_risk: z.number().nullish(),
  high_risk_m: z.number().nullish(),
  no_data_pct: z.number().nullish(),
  n_phones: z.number().nullish(),
})
const backendPlan = z.looseObject({ safe: backendRoute, shortest: backendRoute })

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

function toRoute(kind: RouteKind, r: z.infer<typeof backendRoute>): Route {
  const path = r.geometry.coordinates.map((c) => [c[0], c[1]] as LngLat)
  const mean = clamp01(r.mean_risk ?? 0)
  const warnings: string[] = []
  const highRiskM = r.high_risk_m ?? 0
  if (highRiskM >= 50) warnings.push(`About ${Math.round(highRiskM / 10) * 10} m of this route crosses higher-risk blocks`)
  if ((r.no_data_pct ?? 0) >= 25) warnings.push('Part of this route has no safety data')
  const phones = Math.round(r.n_phones ?? 0)
  return {
    id: `route-${kind}`,
    kind,
    path,
    distanceM: Math.round(r.length_m),
    durationS: Math.round(r.length_m / WALK_MPS),
    risk: { mean, max: clamp01(r.max_risk ?? mean) },
    segments: [{ path, score: mean }],
    warnings,
    highlights: phones > 0 ? [`Passes ${phones} emergency ${phones === 1 ? 'phone' : 'phones'}`] : [],
    steps: stepsFromGeometry(path),
  }
}

/** Fastest first, like the route cards. When both plans are the same line, only one route comes back. */
export function parseRoutes(raw: unknown): Route[] {
  const plan = backendPlan.parse(raw)
  const safest = toRoute('safest', plan.safe)
  const fastest = toRoute('fastest', plan.shortest)
  const same = safest.path.length === fastest.path.length && safest.path.every((p, i) => p[0] === fastest.path[i]![0] && p[1] === fastest.path[i]![1])
  return same ? [safest] : [fastest, safest]
}

const latLng = ([lng, lat]: LngLat) => `${lat.toFixed(6)},${lng.toFixed(6)}`

export async function fetchRoutes(req: RouteRequest, signal?: AbortSignal): Promise<Route[]> {
  return parseRoutes(await apiFetch(ROUTE_PATH, { query: { from: latLng(req.from), to: latLng(req.to), at: req.at }, signal }))
}

/** A sentence for the directions view when planning failed. */
export function routeErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    // 400: the backend says exactly why (too far apart, not near a walkable street, ...).
    if (e.status === 400 && e.detail) return e.detail.charAt(0).toUpperCase() + e.detail.slice(1)
    if (e.status === 503) return 'The route planner is starting up. Try again in a moment.'
    if (e.status === 0) return 'No connection. Check your network and try again.'
  }
  return 'Routes are not available right now. Try again.'
}
