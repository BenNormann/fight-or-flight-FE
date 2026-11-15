/**
 * Pure geometry for placing a character on the map: rotate to the heading,
 * scale design px to metres for the zoom, convert to lng/lat. No MapLibre import.
 */
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { LngLat, MapMode } from '@/domain'
import { TONE_HEX } from './models'
import type { CharacterColors, CharacterPart, ExtrudedCharacter, Vec2 } from './types'

const EARTH_CIRCUMFERENCE_M = 40_075_016.686
const M_PER_DEG = 111_320
/** MapLibre's world is 512 px wide at zoom 0. */
const TILE_PX = 512

/** Ground metres covered by one screen px at `zoom` and latitude `lat`. */
export const metresPerPx = (lat: number, zoom: number) => (EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_PX * 2 ** zoom)

/**
 * A ring in design px placed at `at`, turned to `headingDeg` (clockwise from
 * north), each unit `mPerUnit` metres. Returned closed, as GeoJSON wants.
 */
export function placeRing(ring: Vec2[], at: LngLat, headingDeg: number, mPerUnit: number): LngLat[] {
  const h = (headingDeg * Math.PI) / 180
  const cos = Math.cos(h)
  const sin = Math.sin(h)
  const kLng = M_PER_DEG * Math.cos((at[1] * Math.PI) / 180)
  const out = ring.map(([x, y]): LngLat => {
    const east = (x * cos + y * sin) * mPerUnit
    const north = (-x * sin + y * cos) * mPerUnit
    return [at[0] + east / kLng, at[1] + north / M_PER_DEG]
  })
  return out.length ? [...out, out[0]!] : out
}

export interface CharacterProps {
  color: string
  /** true: drawn by the extrusion layer; false: by the flat fill. */
  solid: boolean
  /** Metres. */
  base: number
  height: number
  /** The first part's outline, for the 2D casing. */
  outline: boolean
}

export function characterFeatures(
  def: ExtrudedCharacter,
  /** `progressM`: distance travelled, which steps a walking character through its frames. */
  pose: { at: LngLat; headingDeg: number; progressM?: number },
  view: { zoom: number; mode: MapMode },
  colors: CharacterColors,
): FeatureCollection<Polygon, CharacterProps> {
  const m = metresPerPx(pose.at[1], view.zoom)
  const solid = view.mode !== '2d'
  let parts: CharacterPart[] = view.mode === '3d' ? def.solid : view.mode === 'iso' ? def.iso : def.flat
  if (def.walk) {
    const frames = solid ? def.walk.solid : def.walk.flat
    parts = frames[Math.floor(Math.max(0, pose.progressM ?? 0) / def.walk.strideM) % frames.length] ?? parts
  }
  const colorOf = (tone: string) => (tone === 'body' || tone === 'accent' ? colors[tone] : (TONE_HEX[tone] ?? colors.body))
  const features = parts.map(
    (p, i): Feature<Polygon, CharacterProps> => ({
      type: 'Feature',
      properties: { color: colorOf(p.tone), solid, base: solid ? p.base * m : 0, height: solid ? p.height * m : 0, outline: i === 0 || !!def.outlineAll },
      geometry: { type: 'Polygon', coordinates: [placeRing(p.ring, pose.at, pose.headingDeg, m)] },
    }),
  )
  return { type: 'FeatureCollection', features }
}

/** Shortest-way interpolation between two headings in degrees, result in [0, 360). */
export function lerpAngle(a: number, b: number, t: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180
  return (((a + d * t) % 360) + 360) % 360
}

export const lerpLngLat = (a: LngLat, b: LngLat, t: number): LngLat => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
