/**
 * Imperative camera commands for chrome outside the map (locate, zoom and
 * compass buttons). The single MapView registers itself; calls before it
 * mounts are no-ops. No MapLibre import here, so chrome stays out of the map chunk.
 */
import { useAppStore } from '@/state/store'

export interface MapController {
  /** Centre on "you are here". */
  recenter: () => void
  zoomBy: (delta: number) => void
  /** Bearing back to north (and flat in 2D). */
  resetNorth: () => void
  /** Ease back onto the traveller, heading-up again in 3D. */
  followTraveller: () => void
}

let current: MapController | null = null

export function registerMapController(c: MapController): () => void {
  current = c
  return () => {
    if (current === c) current = null
  }
}

export const recenter = () => current?.recenter()
export const zoomIn = () => current?.zoomBy(1)
export const zoomOut = () => current?.zoomBy(-1)
export const resetNorth = () => current?.resetNorth()

/**
 * Resume the navigation follow camera after the user panned, tilted or
 * rotated away: follow on, and the camera eases back onto the traveller.
 */
export function followTraveller() {
  useAppStore.getState().setNavFollowing(true)
  current?.followTraveller()
}

// Bearing, for a compass button that shows (and resets) the 3D rotation.
let bearing = 0
const bearingListeners = new Set<() => void>()

/** Called by MapView on every rotate. */
export function publishBearing(next: number) {
  bearing = next
  bearingListeners.forEach((l) => l())
}
export const getBearing = () => bearing
/** For `useSyncExternalStore(subscribeBearing, getBearing)`. */
export function subscribeBearing(l: () => void) {
  bearingListeners.add(l)
  return () => void bearingListeners.delete(l)
}

// Whether the map is centred on the user, for a locate button that shows what its next press does.
let centredOnUser = false
const centredListeners = new Set<() => void>()

/** Called by MapView when the camera comes to rest or the user's position changes. */
export function publishCentredOnUser(next: boolean) {
  if (next === centredOnUser) return
  centredOnUser = next
  centredListeners.forEach((l) => l())
}
export const getCentredOnUser = () => centredOnUser
/** For `useSyncExternalStore(subscribeCentredOnUser, getCentredOnUser)`. */
export function subscribeCentredOnUser(l: () => void) {
  centredListeners.add(l)
  return () => void centredListeners.delete(l)
}
