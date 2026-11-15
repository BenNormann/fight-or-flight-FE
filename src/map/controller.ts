/**
 * Imperative camera commands for chrome outside the map (locate, zoom and
 * compass buttons). The single MapView registers itself; calls before it
 * mounts are no-ops. No MapLibre import here, so chrome stays out of the map chunk.
 */
export interface MapController {
  /** Centre on "you are here". */
  recenter: () => void
  zoomBy: (delta: number) => void
  /** Bearing back to north (and flat in 2D). */
  resetNorth: () => void
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
