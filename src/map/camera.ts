import type { LngLat, MapMode } from '@/domain'

/**
 * Camera presets on the one MapLibre map. 2D and Iso keep a fixed bearing and
 * pitch (pan and zoom only); 3D frees rotation and pitch.
 */
export interface CameraPreset {
  pitch: number
  bearing: number
  /** Drag-rotate, two-finger rotate and pitch, keyboard rotate. */
  rotate: boolean
}

export const cameraPresets: Record<MapMode, CameraPreset> = {
  '2d': { pitch: 0, bearing: 0, rotate: false },
  iso: { pitch: 55, bearing: -20, rotate: false },
  '3d': { pitch: 60, bearing: -20, rotate: true },
}

export const MAX_PITCH = 70
export const MIN_ZOOM = 11
export const MAX_ZOOM = 19
export const START_ZOOM = 16
/** Zoom for "show me where I am". */
export const LOCATE_ZOOM = 17

/** Building footprints first draw at this zoom. */
export const BUILDINGS_MIN_ZOOM = 13
/**
 * Iso and 3D: below this zoom buildings are a plain `fill` (no extrusion work on the GPU).
 * From here the extrusion layer takes over at height 0 and grows to full height by
 * {@link BUILDINGS_FULL_HEIGHT_ZOOM}, so the switch never pops. Around campus, 14 is
 * where blocks stop reading as individual buildings.
 */
export const BUILDINGS_EXTRUDE_ZOOM = 14
export const BUILDINGS_FULL_HEIGHT_ZOOM = 15.5

const M_PER_DEG_LAT = 111_320
/** About 10 miles. */
export const BOUNDS_RADIUS_M = 16_000

/** Square bounds `radiusM` around `center`, as MapLibre `[[w, s], [e, n]]`. */
export function boundsAround([lng, lat]: LngLat, radiusM = BOUNDS_RADIUS_M): [[number, number], [number, number]] {
  const dLat = radiusM / M_PER_DEG_LAT
  const dLng = radiusM / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180))
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat + dLat],
  ]
}

/** Bounding box of points as `[[w, s], [e, n]]`, or null when empty. */
export function bboxOf(points: LngLat[]): [[number, number], [number, number]] | null {
  if (!points.length) return null
  const lngs = points.map((p) => p[0])
  const lats = points.map((p) => p[1])
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}
