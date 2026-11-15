/**
 * DEMO DATA. DELETE THIS FOLDER when the backend contract is known.
 *
 * SAMPLE DATA placed at real coordinates around USC University Park (positions
 * approximate), typed with src/domain so views and the map can be built before
 * the backend serves places. Names, rooms, hours and events are illustrative,
 * not official USC information. Nothing here is backend data, and nothing here
 * may be imported by src/api.
 *
 * `project` / `unproject` convert between LngLat and local metres (x east,
 * y south) on a 1600 m square around the campus centre, for distances and
 * route shapes.
 */
import type {
  Building,
  CampusEvent,
  Id,
  LngLat,
  Poi,
  Room,
  Route,
  RouteKind,
  RouteSegment,
  SearchResult,
} from '@/domain'
import { parsePin } from '@/lib/pin'
import { stepsFromPath } from '@/lib/nav/steps'
import { formatHour as t } from '@/lib/time'

export const PLANE = 1600
/** Campus centre, USC University Park. */
export const CAMPUS_CENTER: LngLat = [-118.2851, 34.0224]
const M_PER_DEG_LAT = 111_320
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((CAMPUS_CENTER[1] * Math.PI) / 180)

export function project([lng, lat]: LngLat): [x: number, y: number] {
  return [PLANE / 2 + (lng - CAMPUS_CENTER[0]) * M_PER_DEG_LNG, PLANE / 2 - (lat - CAMPUS_CENTER[1]) * M_PER_DEG_LAT]
}
export function unproject(x: number, y: number): LngLat {
  return [CAMPUS_CENTER[0] + (x - PLANE / 2) / M_PER_DEG_LNG, CAMPUS_CENTER[1] - (y - PLANE / 2) / M_PER_DEG_LAT]
}

/** Move a point by metres (east, south). */
const offset = (at: LngLat, east: number, south: number): LngLat => {
  const [x, y] = project(at)
  return unproject(x + east, y + south)
}

// ── Buildings ────────────────────────────────────────────────────────────────

interface BuildingSpec {
  id: Id
  code: string
  name: string
  /** Approximate centre. */
  at: LngLat
  /** Footprint width and depth in metres. */
  size: [w: number, h: number]
  floors: number
  address: string
}

const buildingSpecs: BuildingSpec[] = [
  { id: 'b-lib', code: 'DML', name: 'Doheny Memorial Library', at: [-118.2837, 34.02016], size: [80, 60], floors: 5, address: '3550 Trousdale Pkwy' },
  { id: 'b-sci', code: 'SGM', name: 'Seeley G. Mudd Building', at: [-118.2891, 34.0212], size: [70, 45], floors: 4, address: '3620 McClintock Ave' },
  { id: 'b-uni', code: 'TCC', name: 'Ronald Tutor Campus Center', at: [-118.2863, 34.0203], size: [90, 70], floors: 3, address: '3607 Trousdale Pkwy' },
  { id: 'b-eng', code: 'RTH', name: 'Ronald Tutor Hall', at: [-118.28985, 34.02], size: [60, 60], floors: 6, address: '3710 McClintock Ave' },
  { id: 'b-art', code: 'DRC', name: 'Drama Center', at: [-118.288, 34.0226], size: [60, 45], floors: 2, address: '1029 Childs Way' },
  { id: 'b-rec', code: 'LRC', name: 'Lyon Recreation Center', at: [-118.28835, 34.02415], size: [90, 70], floors: 2, address: '1026 W 34th St' },
  { id: 'b-gar', code: 'PSX', name: 'Royal Street Parking', at: [-118.2812, 34.023], size: [110, 60], floors: 4, address: '3335 S Figueroa St' },
]

function rectPolygon(at: LngLat, [w, h]: [number, number]) {
  const corner = (e: number, s: number) => offset(at, e, s)
  const ring = [corner(-w / 2, -h / 2), corner(w / 2, -h / 2), corner(w / 2, h / 2), corner(-w / 2, h / 2), corner(-w / 2, -h / 2)]
  return { type: 'Polygon' as const, coordinates: [ring] }
}

export const buildings: Building[] = buildingSpecs.map((b) => ({
  id: b.id,
  code: b.code,
  name: b.name,
  footprint: rectPolygon(b.at, b.size),
  centroid: b.at,
  floors: b.floors,
  heightM: b.floors * 4,
  address: b.address,
  entrances: [
    { id: `${b.id}-main`, lngLat: offset(b.at, 0, b.size[1] / 2), name: 'Main entrance', accessible: true },
    { id: `${b.id}-side`, lngLat: offset(b.at, -b.size[0] / 2, 0), name: 'West door' },
  ],
}))

// ── Rooms ────────────────────────────────────────────────────────────────────

const roomRows: [Id, string, string, string, number?][] = [
  ['b-lib', 'Grand reading room', 'G', 'Study', 64],
  ['b-lib', 'Group study 2A', '2', 'Study', 8],
  ['b-lib', 'Group study 2B', '2', 'Study', 6],
  ['b-lib', 'Map and data lab', '3', 'Lab', 24],
  ['b-lib', 'Archives reading room', '4', 'Study', 18],
  ['b-lib', 'Literatea Cafe', 'G', 'Food'],
  ['b-sci', 'Lecture hall 110', '1', 'Lecture', 212],
  ['b-sci', 'Chemistry lab 214', '2', 'Lab', 36],
  ['b-sci', 'Seminar room 305', '3', 'Seminar', 22],
  ['b-uni', 'Campus Center food court', '1', 'Food'],
  ['b-uni', 'Trojan Grand Ballroom', '3', 'Event space', 420],
  ['b-uni', 'Student services desk', '1', 'Service'],
  ['b-eng', 'Maker space', 'B1', 'Lab', 40],
  ['b-eng', 'Lecture hall 101', '1', 'Lecture', 160],
  ['b-eng', 'Design studio 410', '4', 'Studio', 48],
  ['b-art', 'Scene Dock Theatre', '1', 'Event space', 120],
  ['b-rec', 'Climbing wall', '1', 'Recreation'],
]

export const rooms: Room[] = roomRows.map(([buildingId, name, floor, type, capacity], i) => ({
  id: `r-${i + 1}`,
  buildingId,
  name,
  floor,
  type,
  capacity,
}))

// ── POIs ─────────────────────────────────────────────────────────────────────

const poiAt = (id: Id, type: Poi['type'], lngLat: LngLat, name?: string): Poi => ({ id, type, name, lngLat })

export const pois: Poi[] = [
  poiAt('p-bl-1', 'blue_light', [-118.2852, 34.0215], 'Blue light, Trousdale Pkwy'),
  poiAt('p-bl-2', 'blue_light', [-118.287, 34.0217], 'Blue light, Childs Way'),
  poiAt('p-bl-3', 'blue_light', [-118.2896, 34.0228], 'Blue light, McClintock Ave'),
  poiAt('p-bl-4', 'blue_light', [-118.2817, 34.0226], 'Blue light, Royal St garage'),
  poiAt('p-dps', 'dps', [-118.28945, 34.0234], 'USC DPS, McClintock Ave station'),
  poiAt('p-cafe-1', 'cafe', [-118.28345, 34.0203], 'Literatea Cafe'),
  poiAt('p-cafe-2', 'cafe', [-118.282, 34.0208], 'Figueroa Noodle Bar'),
  poiAt('p-park-1', 'parking', [-118.2815, 34.0233], 'Royal St garage, levels 1 to 4'),
  poiAt('p-park-2', 'parking', [-118.2864, 34.019], 'Lot 6, surface'),
  poiAt('p-bike-1', 'bike_rack', [-118.2895, 34.02025], 'Bike racks, Tutor Hall'),
]

// ── Categories and place details ─────────────────────────────────────────────

export const CATEGORIES = [
  { id: 'buildings', label: 'Buildings' },
  { id: 'food', label: 'Food' },
  { id: 'study', label: 'Study' },
  { id: 'parking', label: 'Parking' },
  { id: 'events', label: 'Events' },
  { id: 'safety', label: 'Safety' },
] as const
export type CategoryId = (typeof CATEGORIES)[number]['id']

export interface PlaceMeta {
  categories: CategoryId[]
  hours?: string
  openNow?: boolean
  blurb?: string
}

export const placeMeta: Record<Id, PlaceMeta> = {
  'b-lib': { categories: ['buildings', 'study'], hours: `Open until ${t(2)}`, openNow: true, blurb: 'Grand reading room, quiet stacks upstairs and a cafe off the main hall.' },
  'b-sci': { categories: ['buildings', 'study'], hours: `Open until ${t(22)}`, openNow: true, blurb: 'Teaching labs and a large lecture hall on McClintock.' },
  'b-uni': { categories: ['buildings', 'food'], hours: `Open until ${t(23, 30)}`, openNow: true, blurb: 'Food court, student services and the Trojan Grand Ballroom.' },
  'b-eng': { categories: ['buildings', 'study'], hours: `Card access after ${t(19)}`, openNow: true, blurb: 'Maker space in the basement, design studios upstairs.' },
  'b-art': { categories: ['buildings'], hours: `Open until ${t(21)}`, openNow: true, blurb: 'Rehearsal rooms and the Scene Dock Theatre.' },
  'b-rec': { categories: ['buildings'], hours: `Open until ${t(23)}`, openNow: true, blurb: 'Pool, courts and the climbing wall.' },
  'b-gar': { categories: ['buildings', 'parking'], hours: 'Open 24 hours', openNow: true, blurb: '612 spaces. Pay by plate at level 1.' },
  'p-cafe-1': { categories: ['food'], hours: `Open until ${t(21)}`, openNow: true },
  'p-cafe-2': { categories: ['food'], hours: `Closes at ${t(20, 30)}`, openNow: false },
  'p-park-1': { categories: ['parking'], hours: 'Open 24 hours', openNow: true },
  'p-park-2': { categories: ['parking'], hours: `Permit after ${t(18)}`, openNow: true },
  'p-dps': { categories: ['safety'], hours: 'Staffed 24 hours', openNow: true },
  'p-bl-1': { categories: ['safety'] },
  'p-bl-2': { categories: ['safety'] },
  'p-bl-3': { categories: ['safety'] },
  'p-bl-4': { categories: ['safety'] },
}

// ── Events ───────────────────────────────────────────────────────────────────

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()

export const events: CampusEvent[] = [
  { id: 'e-1', title: 'Open mic night', start: inHours(1.5), end: inHours(3.5), location: 'Scene Dock Theatre', buildingId: 'b-art' },
  { id: 'e-2', title: 'Late study hall with free coffee', start: inHours(3), end: inHours(7), location: 'Grand reading room', buildingId: 'b-lib' },
  { id: 'e-3', title: 'Trojan robotics build session', start: inHours(19), end: inHours(22), location: 'Maker space', buildingId: 'b-eng' },
  { id: 'e-4', title: 'Viterbi career fair: engineering and data', start: inHours(26), end: inHours(31), location: 'Trojan Grand Ballroom', buildingId: 'b-uni' },
  { id: 'e-5', title: 'Indoor climbing intro clinic', start: inHours(45), end: inHours(47), location: 'Climbing wall', buildingId: 'b-rec' },
]

// ── Lookup ───────────────────────────────────────────────────────────────────

export const findBuilding = (id: Id | null | undefined) => buildings.find((b) => b.id === id)
export const findRoom = (id: Id | null | undefined) => rooms.find((r) => r.id === id)
export const findPoi = (id: Id | null | undefined) => pois.find((p) => p.id === id)
export const findEvent = (id: Id | null | undefined) => events.find((e) => e.id === id)
export const roomsIn = (buildingId: Id) => rooms.filter((r) => r.buildingId === buildingId)

/** Name and position for anything a route can go to. */
export function placeOf(id: Id | null | undefined): { id: Id; name: string; lngLat: LngLat } | undefined {
  const b = findBuilding(id)
  if (b) return { id: b.id, name: b.name, lngLat: b.entrances[0]?.lngLat ?? b.centroid }
  const r = findRoom(id)
  if (r) {
    const rb = findBuilding(r.buildingId)
    return rb ? { id: r.id, name: `${r.name}, ${rb.code}`, lngLat: rb.entrances[0]?.lngLat ?? rb.centroid } : undefined
  }
  const p = findPoi(id)
  if (p) return { id: p.id, name: p.name ?? 'Pinned place', lngLat: p.lngLat }
  const pin = parsePin(id)
  if (pin && id) return { id, name: 'Dropped pin', lngLat: pin }
  return undefined
}

export const POI_LABEL: Record<string, string> = {
  blue_light: 'Emergency phone',
  dps: 'Campus police',
  cafe: 'Cafe',
  parking: 'Parking',
  bike_rack: 'Bike racks',
  entrance: 'Entrance',
  seating: 'Seating',
}

/** Client side filter over the demo set. The real search is a backend call. */
export function demoSearch(query: string, category: string | null): SearchResult[] {
  const q = query.trim().toLowerCase()
  const inCat = (id: Id) => !category || (placeMeta[id]?.categories as string[] | undefined)?.includes(category)
  const hit = (s: string) => !q || s.toLowerCase().includes(q)
  const out: SearchResult[] = []
  for (const b of buildings)
    if (inCat(b.id) && (hit(b.name) || hit(b.code)))
      out.push({ kind: 'building', id: b.id, label: b.name, sublabel: `${b.code} · ${b.address}`, lngLat: b.centroid })
  if (q && !category)
    for (const r of rooms) {
      if (!hit(r.name)) continue
      const rb = findBuilding(r.buildingId)
      out.push({ kind: 'room', id: r.id, label: r.name, sublabel: `${rb?.name ?? ''} · Floor ${r.floor}` })
    }
  for (const p of pois)
    if (placeMeta[p.id] && inCat(p.id) && hit(p.name ?? ''))
      out.push({ kind: 'poi', id: p.id, label: p.name ?? POI_LABEL[p.type] ?? 'Place', sublabel: POI_LABEL[p.type], lngLat: p.lngLat })
  if (category === 'events' || (q && !category))
    for (const e of events)
      if (hit(e.title)) out.push({ kind: 'event', id: e.id, label: e.title, sublabel: e.location })
  return out
}

// ── Routes (fake backend output) ─────────────────────────────────────────────

/** Where "Your location" sits: the Exposition Blvd gate at Trousdale Pkwy. */
export const ORIGIN: LngLat = [-118.2852, 34.0187]

const SPEED_MPS = { walk: 1.35, bike: 4.6, ride: 7.5 } as const
export type DemoTravelMode = keyof typeof SPEED_MPS

function lengthM(path: LngLat[]) {
  let m = 0
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = project(path[i - 1]!)
    const [bx, by] = project(path[i]!)
    m += Math.hypot(bx - ax, by - ay)
  }
  return m
}

function makeRoute(kind: RouteKind, to: LngLat, mode: DemoTravelMode, from: LngLat): Route {
  const [tx, ty] = project(to)
  const [ox, oy] = project(from)
  // Safest hugs the lit avenue on the west edge; fastest cuts through Lot 6 and the quad.
  const waypoints: [number, number][] =
    kind === 'safest'
      ? [[ox, oy], [ox, ty + 16], [tx, ty + 16], [tx, ty]]
      : [[ox, oy], [ox + (tx - ox) * 0.45, oy - 40], [tx, ty + (oy - ty) * 0.35], [tx, ty]]
  const path = waypoints.map(([x, y]) => unproject(x, y))
  // Sample street names, one per segment (illustrative, like the rest of this folder).
  const legNames = kind === 'safest' ? ['Trousdale Pkwy', 'Childs Way', undefined] : ['Lot 6 path', 'Hahn Plaza', undefined]
  const scores = kind === 'safest' ? [0.12, 0.18, 0.09] : [0.31, 0.74, 0.42]
  const segments: RouteSegment[] = path.slice(1).map((p, i) => ({ path: [path[i]!, p], score: scores[i] ?? 0.2 }))
  const distanceM = Math.round(lengthM(path))
  const wait = mode === 'ride' ? 240 : 0
  return {
    id: `route-${kind}`,
    kind,
    path,
    distanceM,
    durationS: Math.round(distanceM / SPEED_MPS[mode] + wait),
    risk: kind === 'safest' ? { mean: 0.13, max: 0.18 } : { mean: 0.49, max: 0.74 },
    segments,
    warnings: kind === 'safest' ? [] : ['Crosses Lot 6, which is poorly lit after dark'],
    steps: stepsFromPath(path, legNames),
  }
}

export function demoRoutes(destination: Id | null, mode: DemoTravelMode, from: LngLat = ORIGIN): Route[] {
  const to = placeOf(destination)
  if (!to) return []
  return [makeRoute('fastest', to.lngLat, mode, from), makeRoute('safest', to.lngLat, mode, from)]
}

// ── Map layers (demo toggles; real ones come from src/map/layers/registry) ───

/** Id of the safety heat toggle, for views that switch it on directly. */
export const SAFETY_HEAT_LAYER = 'demo-safety'

export type DemoLayerIcon = 'heat' | 'phone' | 'events' | 'parking'

/** The one list of demo toggles. Views render it; nothing else names these ids. */
export const demoLayers: readonly { id: string; label: string; description: string; icon: DemoLayerIcon; defaultOn: boolean }[] = [
  { id: SAFETY_HEAT_LAYER, label: 'Safety heat', description: 'Relative risk by area, from the backend', icon: 'heat', defaultOn: false },
  { id: 'demo-bluelights', label: 'Emergency phones', description: 'Blue light call boxes', icon: 'phone', defaultOn: true },
  { id: 'demo-events', label: 'Events', description: 'Happening in the next 48 hours', icon: 'events', defaultOn: true },
  { id: 'demo-transit', label: 'Parking and bikes', description: 'Garages, lots and racks', icon: 'parking', defaultOn: true },
]

export const demoLayerDefaults: Record<string, boolean> = Object.fromEntries(demoLayers.map((l) => [l.id, l.defaultOn]))

