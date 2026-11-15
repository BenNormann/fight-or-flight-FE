/**
 * The last leg of a trip to a room: up the building. Pure geometry for the map:
 * a band around the building at the room's floor, and a column of "hops" (one per storey
 * climbed) rising from where the route ends. Drawn with fill-extrusion in Iso and 3D.
 */
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { LngLat } from '@/domain'

/** A typical storey. Buildings carry a height but no floor count, so floors are placed by this. */
export const STOREY_M = 4
/** The band sits just outside the walls, or it would fight with them for the same pixels. */
const BAND_GROW = 1.035
/** Side of a hop block, metres. */
const HOP_SIDE_M = 1.8
const M_PER_DEG = 111_320

export type FloorProps = { role: 'band' | 'hop'; base: number; height: number }

/** Height of one storey in a building `heightM` tall where `floor` must still fit under the roof. */
export const storeyHeight = (heightM: number, floor: number) => Math.min(STOREY_M, heightM / Math.max(1, floor))

/** Bottom and top of a floor above ground (floor 1 starts at the ground). Null for floors below ground. */
export function floorSpan(floor: number, heightM: number): { base: number; top: number } | null {
  if (floor < 1) return null
  const s = storeyHeight(heightM, floor)
  return { base: (floor - 1) * s, top: floor * s }
}

/** A ring scaled about its centre. */
export function growRing(ring: LngLat[], factor = BAND_GROW): LngLat[] {
  const n = ring.length || 1
  const cx = ring.reduce((a, p) => a + p[0], 0) / n
  const cy = ring.reduce((a, p) => a + p[1], 0) / n
  return ring.map((p) => [cx + (p[0] - cx) * factor, cy + (p[1] - cy) * factor])
}

const square = ([lng, lat]: LngLat, sideM: number): LngLat[] => {
  const dy = sideM / 2 / M_PER_DEG
  const dx = dy / Math.cos((lat * Math.PI) / 180)
  return [
    [lng - dx, lat - dy],
    [lng + dx, lat - dy],
    [lng + dx, lat + dy],
    [lng - dx, lat + dy],
    [lng - dx, lat - dy],
  ]
}

const closed = (ring: LngLat[]) => (ring.length && (ring[0]![0] !== ring.at(-1)![0] || ring[0]![1] !== ring.at(-1)![1]) ? [...ring, ring[0]!] : ring)

/**
 * The floor band and the hops. `footprint`: the building's outer ring; `heightM`: its height;
 * `at`: where the hops rise (the end of the route on the ground). Empty for floors below ground.
 */
export function floorHopFeatures(footprint: LngLat[], heightM: number, floor: number, at: LngLat): FeatureCollection<Polygon, FloorProps> {
  const span = floorSpan(floor, heightM)
  if (!span || footprint.length < 3) return { type: 'FeatureCollection', features: [] }
  const s = storeyHeight(heightM, floor)
  const poly = (ring: LngLat[], props: FloorProps): Feature<Polygon, FloorProps> => ({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [closed(ring)] } })
  const hops = Array.from({ length: floor - 1 }, (_, i) => poly(square(at, HOP_SIDE_M), { role: 'hop', base: i * s + s * 0.2, height: i * s + s * 0.85 }))
  return { type: 'FeatureCollection', features: [poly(growRing(footprint), { role: 'band', base: span.base, height: span.top }), ...hops] }
}
