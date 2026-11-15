/**
 * Demo mode, for recording the app away from campus.
 *
 *   ?demo             you stand at Tommy Trojan
 *   ?demo=34.02,-118.28   you stand at that lat,lng
 *   ?demo=off         back to the real device location
 *
 * While on: "your location" is a fixed point instead of the device GPS (no location prompt),
 * every started route is walked for you by the simulator, and the simulator's pause/speed
 * control is shown. After you arrive, "your location" moves to where the route ended, so the
 * next trip starts from there. The setting is kept for the browser tab (sessionStorage), so it
 * survives in-app navigation and reloads that drop the query string.
 */
import type { LngLat } from '@/domain'

const KEY = 'odyssey.demo'

/** Tommy Trojan, centre of the University Park campus. */
export const DEMO_DEFAULT_START: LngLat = [-118.2856, 34.0206]

export interface DemoMode {
  /** Where "you" stand when the tab opens. */
  start: LngLat
}

/** Parse the `demo` query value. `undefined` = no opinion (not in the URL), `null` = off. */
export function parseDemoParam(value: string | null): DemoMode | null | undefined {
  if (value === null) return undefined
  const v = value.trim().toLowerCase()
  if (v === 'off' || v === 'false' || v === '0') return null
  const m = v.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (m) {
    const lat = Number(m[1])
    const lng = Number(m[2])
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { start: [lng, lat] }
  }
  return { start: DEMO_DEFAULT_START }
}

function storage(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null
  } catch {
    return null   // blocked storage (private mode, sandboxed frame)
  }
}

/** Read the URL first, then what this tab remembered; store the result. */
export function resolveDemoMode(search: string): DemoMode | null {
  const s = storage()
  const fromUrl = parseDemoParam(new URLSearchParams(search).get('demo'))
  if (fromUrl !== undefined) {
    try {
      if (fromUrl) s?.setItem(KEY, JSON.stringify(fromUrl))
      else s?.removeItem(KEY)
    } catch {
      /* storage full or blocked: demo still applies to this page load */
    }
    return fromUrl
  }
  try {
    const saved = s?.getItem(KEY)
    if (!saved) return null
    const parsed = JSON.parse(saved) as DemoMode
    return Array.isArray(parsed.start) && parsed.start.length === 2 ? parsed : null
  } catch {
    return null
  }
}

/** Decided once at startup. */
export const demoMode: DemoMode | null = typeof window !== 'undefined' ? resolveDemoMode(window.location.search) : null
