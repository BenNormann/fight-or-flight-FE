/**
 * Named areas outlined on the map. The backend serves no zones endpoint yet
 * (docs/BACKEND_CONTRACT.md), so the outlines live here with their sources. Replace
 * with an adapter when the backend serves them.
 */
import type { Feature, FeatureCollection, LineString, MultiPolygon, Polygon } from 'geojson'
import type { LngLat } from '@/domain'

/**
 * USC University Park Campus and USC Village. Copied from the backend's own outline
 * (fight-or-flight-BE `pathfinding/campus.py`, `ZERO_RISK_ZONES`), which follows street centrelines:
 * Vermont (W), Jefferson (N), Figueroa (E), Exposition (S); the Village is the block north of Jefferson.
 * The Village's edges were then corrected against OpenStreetMap street centrelines (see below).
 */
const CAMPUS: LngLat[] = [
  [-118.2915, 34.0255],
  [-118.2885, 34.0255],
  [-118.28711, 34.02506], // Jefferson / McClintock
  [-118.284, 34.0238],
  [-118.2802, 34.022],
  [-118.2825, 34.0183],
  [-118.2915, 34.0183],
]
const VILLAGE: LngLat[] = [
  // West edge: the McClintock Avenue centreline itself (from OpenStreetMap). The backend's outline ran
  // about 25 m west of it here, through the apartment buildings across the street.
  [-118.28711, 34.02506], // McClintock / Jefferson
  [-118.28687, 34.02544],
  [-118.28606, 34.02637],
  [-118.28578, 34.0269],
  [-118.28551, 34.02726],
  [-118.28504, 34.02736],
  [-118.28499, 34.02741], // McClintock / 30th
  [-118.28399, 34.0274], // 30th / Hoover
  [-118.28397, 34.02563],
  [-118.28384, 34.02461],
  [-118.28388, 34.02401],
  [-118.284, 34.0238], // Hoover / Jefferson
]

/**
 * USC Department of Public Safety patrol area for the University Park Campus.
 * Source: the street-by-street boundary on https://dps.usc.edu/patrol/ ("UPC Patrol Area"),
 * each corner placed at the crossing of the two named streets in OpenStreetMap road data.
 * Edges are straight between corners, so a bending street is followed only approximately.
 */
const DPS_PATROL: LngLat[] = [
  [-118.29163, 34.01824], // Vermont / Exposition
  [-118.30024, 34.01843], // Exposition / Normandie
  [-118.30036, 34.03272], // Normandie / Adams
  [-118.29158, 34.03281], // Adams / Vermont
  [-118.29163, 34.03566], // Vermont / 22nd
  [-118.28406, 34.03591], // 22nd / Hoover
  [-118.28419, 34.03997], // Hoover / Washington
  [-118.26831, 34.03283], // Washington / Grand
  [-118.27626, 34.02018], // Grand / Jefferson
  [-118.27483, 34.01958], // Jefferson / Hill
  [-118.27696, 34.01633], // Hill / 37th
  [-118.27816, 34.01678], // 37th / Grand
  [-118.28028, 34.01368], // Grand / 39th
  [-118.28269, 34.01408], // 39th / Figueroa
  [-118.28279, 34.01105], // Figueroa / Martin Luther King Jr
  [-118.29153, 34.0108], // Martin Luther King Jr / Vermont
]

const close = (ring: LngLat[]): LngLat[] => [...ring, ring[0]!]

export type ZoneId = 'campus' | 'dps'
export type ZoneProps = { zone: ZoneId; label: string }

/** Outlines as lines, one per ring. */
export function zoneOutlines(): FeatureCollection<LineString, ZoneProps> {
  const line = (ring: LngLat[], props: ZoneProps): Feature<LineString, ZoneProps> => ({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: close(ring) } })
  return {
    type: 'FeatureCollection',
    features: [
      line(DPS_PATROL, { zone: 'dps', label: 'USC DPS patrol area' }),
      line(CAMPUS, { zone: 'campus', label: 'USC campus' }),
      line(VILLAGE, { zone: 'campus', label: 'USC Village' }),
    ],
  }
}

/** The same areas as filled shapes, for a faint tint on the ground inside each. */
export function zoneAreas(): FeatureCollection<Polygon, ZoneProps> {
  const area = (ring: LngLat[], props: ZoneProps): Feature<Polygon, ZoneProps> => ({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [close(ring)] } })
  return {
    type: 'FeatureCollection',
    features: [
      area(DPS_PATROL, { zone: 'dps', label: 'USC DPS patrol area' }),
      area(CAMPUS, { zone: 'campus', label: 'USC campus' }),
      area(VILLAGE, { zone: 'campus', label: 'USC Village' }),
    ],
  }
}

/** The campus area (campus and Village), for telling campus buildings from the rest. */
export const CAMPUS_AREA: MultiPolygon = { type: 'MultiPolygon', coordinates: [[close(CAMPUS)], [close(VILLAGE)]] }
