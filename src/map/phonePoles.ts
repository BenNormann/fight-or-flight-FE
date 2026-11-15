/**
 * Blue light emergency phones as small 3D poles: a foot, a slim post, a phone box and a lit blue
 * lamp, built from extruded blocks. A fixed size on the ground, about two storeys tall, so they sit among the
 * buildings as street furniture rather than as markers. Pure geometry; no MapLibre import.
 */
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import type { LngLat } from '@/domain'
import { BLUE_PHONES } from './bluePhones'

const M_PER_DEG = 111_320

/** One block of the pole: half-width, bottom and top in metres, and its colour. The lamp tops out at two storeys. */
const PARTS = [
  { half: 0.9, base: 0, top: 0.35, color: 'post' }, // foot
  { half: 0.35, base: 0.35, top: 6.8, color: 'post' }, // post
  { half: 0.75, base: 2.6, top: 4.4, color: 'box' }, // phone box
  { half: 0.75, base: 6.8, top: 8, color: 'lamp' }, // lamp
] as const

export type PoleColors = Record<(typeof PARTS)[number]['color'], string>
export type PoleProps = { color: string; base: number; height: number }

const square = ([lng, lat]: LngLat, halfM: number): LngLat[] => {
  const dy = halfM / M_PER_DEG
  const dx = dy / Math.cos((lat * Math.PI) / 180)
  return [
    [lng - dx, lat - dy],
    [lng + dx, lat - dy],
    [lng + dx, lat + dy],
    [lng - dx, lat + dy],
    [lng - dx, lat - dy],
  ]
}

/** Every pole as extrusions. */
export function phonePoleFeatures(colors: PoleColors, phones = BLUE_PHONES): FeatureCollection<Polygon, PoleProps> {
  const features = phones.flatMap((p) =>
    PARTS.map(
      (part): Feature<Polygon, PoleProps> => ({
        type: 'Feature',
        properties: { color: colors[part.color], base: part.base, height: part.top },
        geometry: { type: 'Polygon', coordinates: [square(p.lngLat, part.half)] },
      }),
    ),
  )
  return { type: 'FeatureCollection', features }
}

/** One point per phone: the faint glow at its foot (drawn over buildings) and the tap target. */
export const PHONE_POINTS: FeatureCollection<Point, { name: string }> = {
  type: 'FeatureCollection',
  features: BLUE_PHONES.map((p) => ({ type: 'Feature', properties: { name: p.name }, geometry: { type: 'Point', coordinates: p.lngLat } })),
}
