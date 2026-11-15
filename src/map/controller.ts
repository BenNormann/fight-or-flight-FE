/**
 * Imperative camera commands for chrome outside the map (locate button,
 * zoom buttons). The single MapView registers itself; calls before it mounts
 * are no-ops. No store field needed: the camera is not app state.
 */
export interface MapController {
  /** Centre on "you are here" at the default zoom. */
  recenter: () => void
  zoomBy: (factor: number) => void
}

let current: MapController | null = null

export function registerMapController(c: MapController): () => void {
  current = c
  return () => {
    if (current === c) current = null
  }
}

export const recenter = () => current?.recenter()
export const zoomIn = () => current?.zoomBy(2)
export const zoomOut = () => current?.zoomBy(0.5)
