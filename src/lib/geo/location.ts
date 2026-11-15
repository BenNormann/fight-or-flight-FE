/**
 * The device's own position, for the "you are here" dot and as a start point.
 * One watcher for the whole app. Nothing is asked of the browser until the user
 * agrees in our own prompt (or location was already allowed on an earlier visit).
 * Sharing the position with the backend is separate (`useLiveLocation`).
 */
import { useSyncExternalStore } from 'react'
import type { LocationFix } from '@/domain'

/**
 * `unknown`: not checked yet. `prompt`: the browser will ask. `granted` / `denied`: the user's answer.
 * `unsupported`: no geolocation here (old browser, or a page not served over HTTPS).
 */
export type LocationStatus = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unsupported'

export interface LocationState {
  status: LocationStatus
  fix: LocationFix | null
  /** A request is waiting for the browser prompt or the first fix. */
  asking: boolean
}

let state: LocationState = { status: 'unknown', fix: null, asking: false }
const listeners = new Set<() => void>()
let watchId: number | null = null
let waiting: ((fix: LocationFix | null) => void)[] = []

function set(patch: Partial<LocationState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

const geo = () => (typeof navigator !== 'undefined' && 'geolocation' in navigator && (typeof isSecureContext === 'undefined' || isSecureContext) ? navigator.geolocation : null)

function settle(fix: LocationFix | null) {
  const done = waiting
  waiting = []
  done.forEach((resolve) => resolve(fix))
}

export function toLocationFix(p: GeolocationPosition): LocationFix {
  const { longitude, latitude, accuracy, heading, speed } = p.coords
  return {
    lngLat: [longitude, latitude],
    accuracyM: accuracy,
    ...(heading != null && Number.isFinite(heading) ? { headingDeg: heading } : {}),
    ...(speed != null && Number.isFinite(speed) ? { speedMps: speed } : {}),
    at: new Date(p.timestamp).toISOString(),
  }
}

/** The browser refused when we actually asked (not what the permission query guessed). */
let refused = false

function watch(g: Geolocation, highAccuracy = true) {
  if (watchId !== null) return
  watchId = g.watchPosition(
    (p) => {
      refused = false
      const fix = toLocationFix(p)
      set({ status: 'granted', fix, asking: false })
      settle(fix)
    },
    (e) => {
      g.clearWatch(watchId!)
      watchId = null
      if (e.code === e.PERMISSION_DENIED) {
        refused = true
        set({ status: 'denied', fix: null, asking: false })
        settle(null)
      } else if (highAccuracy && !state.fix) {
        // No GPS fix in time (indoors, or precise location off on iOS): a coarse position beats none.
        watch(g, false)
      } else {
        set({ asking: false })
        settle(null)
      }
    },
    { enableHighAccuracy: highAccuracy, maximumAge: 10_000, timeout: highAccuracy ? 12_000 : 20_000 },
  )
}

/** Check the permission without prompting. Already allowed: start watching straight away. */
export async function initLocation(): Promise<void> {
  if (state.status !== 'unknown') return
  const g = geo()
  if (!g) return set({ status: 'unsupported' })
  try {
    const p = await navigator.permissions.query({ name: 'geolocation' })
    const apply = () => {
      if (p.state === 'granted') {
        watch(g)
        if (!state.fix) set({ status: 'granted' })
      } else if (!state.fix && !refused) {
        // Safari's answer here is unreliable (it can say "denied" or stay on "prompt" whatever the user chose),
        // so anything short of "granted" only means: ask. A real refusal comes from the request itself.
        set({ status: 'prompt' })
      }
    }
    apply()
    p.onchange = apply
  } catch {
    // No Permissions API (older Safari): we only find out by asking.
    set({ status: 'prompt' })
  }
}

/**
 * Ask for the position (this is what opens the browser prompt). Resolves with the first fix, or null.
 * Always really asks, even after an earlier refusal: the user may have changed the setting since.
 */
export function requestLocation(): Promise<LocationFix | null> {
  const g = geo()
  if (!g) {
    set({ status: 'unsupported' })
    return Promise.resolve(null)
  }
  if (state.fix && watchId !== null) return Promise.resolve(state.fix)
  set({ asking: true })
  return new Promise((resolve) => {
    waiting.push(resolve)
    watch(g)
  })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
export const getLocation = () => state
export const useUserLocation = () => useSyncExternalStore(subscribe, getLocation, getLocation)

/** How to turn location back on after a refusal: the page cannot ask twice. */
export const LOCATION_DENIED_HELP = "Location is blocked for this site. Allow it in your browser site settings (the icon beside the address), then reload."

/** Tests only. */
export function resetLocationForTest(next: Partial<LocationState> = {}) {
  watchId = null
  refused = false
  waiting = []
  state = { status: 'unknown', fix: null, asking: false, ...next }
  listeners.forEach((l) => l())
}
