/**
 * DEMO DATA. DELETE THIS FOLDER when the backend contract is known.
 *
 * A fictional campus ("Northfield University") typed with src/domain so views
 * and the placeholder map can be built before any adapter exists. Nothing here
 * is backend data, and nothing here may be imported by src/api.
 *
 * Coordinates: the placeholder map is a 1600×1600 px plane at roughly 1 px per
 * metre. `project` / `unproject` convert between that plane and LngLat.
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

export const PLANE = 1600
const CENTER: LngLat = [-93.2275, 44.9735]
const M_PER_DEG_LAT = 111_320
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((CENTER[1] * Math.PI) / 180)

export function project([lng, lat]: LngLat): [x: number, y: number] {
  return [PLANE / 2 + (lng - CENTER[0]) * M_PER_DEG_LNG, PLANE / 2 - (lat - CENTER[1]) * M_PER_DEG_LAT]
}
export function unproject(x: number, y: number): LngLat {
  return [CENTER[0] + (x - PLANE / 2) / M_PER_DEG_LNG, CENTER[1] - (y - PLANE / 2) / M_PER_DEG_LAT]
}

/** Campus area on the plane; the procedural city leaves it empty. */
export const CAMPUS_RECT = { x: 600, y: 400, w: 400, h: 540 }

// ── Buildings ────────────────────────────────────────────────────────────────

interface BuildingSpec {
  id: Id
  code: string
  name: string
  rect: [x: number, y: number, w: number, h: number]
  floors: number
  address: string
}

const buildingSpecs: BuildingSpec[] = [
  { id: 'b-lib', code: 'HOL', name: 'Hollis Library', rect: [632, 432, 124, 92], floors: 5, address: '210 Pleasant St' },
  { id: 'b-sci', code: 'CAR', name: 'Carver Science Hall', rect: [792, 428, 172, 84], floors: 4, address: '116 Church St' },
  { id: 'b-uni', code: 'MAR', name: 'Marlow Student Union', rect: [648, 576, 148, 104], floors: 3, address: '300 Washington Ave' },
  { id: 'b-eng', code: 'ATW', name: 'Atwater Engineering', rect: [840, 560, 124, 128], floors: 6, address: '200 Union St' },
  { id: 'b-art', code: 'PEL', name: 'Pell Arts Center', rect: [632, 736, 116, 92], floors: 2, address: '405 21st Ave' },
  { id: 'b-rec', code: 'RDG', name: 'Ridgeway Rec Center', rect: [800, 740, 164, 112], floors: 2, address: '1906 University Ave' },
  { id: 'b-gar', code: 'GRE', name: 'East Garage', rect: [672, 868, 152, 52], floors: 4, address: '515 Delaware St' },
]

function rectPolygon([x, y, w, h]: BuildingSpec['rect']) {
  const ring = [unproject(x, y), unproject(x + w, y), unproject(x + w, y + h), unproject(x, y + h), unproject(x, y)]
  return { type: 'Polygon' as const, coordinates: [ring] }
}

export const buildings: Building[] = buildingSpecs.map((b) => {
  const [x, y, w, h] = b.rect
  return {
    id: b.id,
    code: b.code,
    name: b.name,
    footprint: rectPolygon(b.rect),
    centroid: unproject(x + w / 2, y + h / 2),
    floors: b.floors,
    heightM: b.floors * 4,
    address: b.address,
    entrances: [
      { id: `${b.id}-main`, lngLat: unproject(x + w / 2, y + h), name: 'Main entrance', accessible: true },
      { id: `${b.id}-side`, lngLat: unproject(x, y + h / 2), name: 'West door' },
    ],
  }
})

// ── Rooms ────────────────────────────────────────────────────────────────────

const roomRows: [Id, string, string, string, number?][] = [
  ['b-lib', 'Quiet reading room', 'G', 'Study', 64],
  ['b-lib', 'Group study 2A', '2', 'Study', 8],
  ['b-lib', 'Group study 2B', '2', 'Study', 6],
  ['b-lib', 'Map and data lab', '3', 'Lab', 24],
  ['b-lib', 'Archives reading room', '4', 'Study', 18],
  ['b-lib', 'Bean and Ledger Cafe', 'G', 'Food'],
  ['b-sci', 'Lecture hall 110', '1', 'Lecture', 212],
  ['b-sci', 'Chemistry lab 214', '2', 'Lab', 36],
  ['b-sci', 'Seminar room 305', '3', 'Seminar', 22],
  ['b-uni', 'Union food court', '1', 'Food'],
  ['b-uni', 'Ballroom', '3', 'Event space', 420],
  ['b-uni', 'Student services desk', '1', 'Service'],
  ['b-eng', 'Maker space', 'B1', 'Lab', 40],
  ['b-eng', 'Lecture hall 120', '1', 'Lecture', 160],
  ['b-eng', 'Design studio 410', '4', 'Studio', 48],
  ['b-art', 'Black box theater', '1', 'Event space', 120],
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

const poiAt = (id: Id, type: Poi['type'], x: number, y: number, name?: string): Poi => ({
  id,
  type,
  name,
  lngLat: unproject(x, y),
})

export const pois: Poi[] = [
  poiAt('p-bl-1', 'blue_light', 776, 548, 'Blue light, Union lawn'),
  poiAt('p-bl-2', 'blue_light', 620, 712, 'Blue light, Pell walk'),
  poiAt('p-bl-3', 'blue_light', 980, 720, 'Blue light, Church St'),
  poiAt('p-bl-4', 'blue_light', 840, 896, 'Blue light, East Garage'),
  poiAt('p-dps', 'dps', 980, 470, 'Campus police, Church St station'),
  poiAt('p-cafe-1', 'cafe', 700, 520, 'Bean and Ledger Cafe'),
  poiAt('p-cafe-2', 'cafe', 1060, 640, 'Sato Noodle Bar'),
  poiAt('p-park-1', 'parking', 748, 894, 'East Garage, level 1 to 4'),
  poiAt('p-park-2', 'parking', 560, 820, 'Lot C, surface'),
  poiAt('p-bike-1', 'bike_rack', 816, 704, 'Bike racks, Atwater'),
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
  'b-lib': { categories: ['buildings', 'study'], hours: 'Open until 2:00', openNow: true, blurb: 'Five floors of study space, a cafe on the ground floor and the map and data lab.' },
  'b-sci': { categories: ['buildings', 'study'], hours: 'Open until 22:00', openNow: true, blurb: 'Teaching labs and the largest lecture hall on the east side.' },
  'b-uni': { categories: ['buildings', 'food'], hours: 'Open until 23:30', openNow: true, blurb: 'Food court, student services and the ballroom.' },
  'b-eng': { categories: ['buildings', 'study'], hours: 'Card access after 19:00', openNow: true, blurb: 'Maker space in the basement, design studios upstairs.' },
  'b-art': { categories: ['buildings'], hours: 'Open until 21:00', openNow: true, blurb: 'Galleries and the black box theater.' },
  'b-rec': { categories: ['buildings'], hours: 'Open until 23:00', openNow: true, blurb: 'Pool, courts and the climbing wall.' },
  'b-gar': { categories: ['buildings', 'parking'], hours: 'Open 24 hours', openNow: true, blurb: '612 spaces. Pay by plate at level 1.' },
  'p-cafe-1': { categories: ['food'], hours: 'Open until 21:00', openNow: true },
  'p-cafe-2': { categories: ['food'], hours: 'Closes at 20:30', openNow: false },
  'p-park-1': { categories: ['parking'], hours: 'Open 24 hours', openNow: true },
  'p-park-2': { categories: ['parking'], hours: 'Permit after 18:00', openNow: true },
  'p-dps': { categories: ['safety'], hours: 'Staffed 24 hours', openNow: true },
  'p-bl-1': { categories: ['safety'] },
  'p-bl-2': { categories: ['safety'] },
  'p-bl-3': { categories: ['safety'] },
  'p-bl-4': { categories: ['safety'] },
}

// ── Events ───────────────────────────────────────────────────────────────────

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()

export const events: CampusEvent[] = [
  { id: 'e-1', title: 'Open mic night', start: inHours(1.5), end: inHours(3.5), location: 'Black box theater', buildingId: 'b-art' },
  { id: 'e-2', title: 'Late study hall with free coffee', start: inHours(3), end: inHours(7), location: 'Quiet reading room', buildingId: 'b-lib' },
  { id: 'e-3', title: 'Robotics club build session', start: inHours(19), end: inHours(22), location: 'Maker space', buildingId: 'b-eng' },
  { id: 'e-4', title: 'Career fair: engineering and data', start: inHours(26), end: inHours(31), location: 'Ballroom', buildingId: 'b-uni' },
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

/** Where "Your location" sits on the demo plane: the south west campus gate. */
export const ORIGIN: LngLat = unproject(612, 968)

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

function makeRoute(kind: RouteKind, to: LngLat, mode: DemoTravelMode): Route {
  const [tx, ty] = project(to)
  const [ox, oy] = project(ORIGIN)
  // Safest hugs the lit avenue on the west edge; fastest cuts through Lot C and the quad.
  const waypoints: [number, number][] =
    kind === 'safest'
      ? [[ox, oy], [ox, ty + 16], [tx, ty + 16], [tx, ty]]
      : [[ox, oy], [ox + (tx - ox) * 0.45, oy - 40], [tx, ty + (oy - ty) * 0.35], [tx, ty]]
  const path = waypoints.map(([x, y]) => unproject(x, y))
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
    warnings: kind === 'safest' ? [] : ['Crosses Lot C, which is poorly lit after dark'],
  }
}

export function demoRoutes(destination: Id | null, mode: DemoTravelMode): Route[] {
  const to = placeOf(destination)
  if (!to) return []
  return [makeRoute('fastest', to.lngLat, mode), makeRoute('safest', to.lngLat, mode)]
}

// ── Map layers (demo toggles; real ones come from src/map/layers/registry) ───

export const demoLayers = [
  { id: 'demo-safety', label: 'Safety heat', description: 'Relative risk by area, from the backend' },
  { id: 'demo-bluelights', label: 'Emergency phones', description: 'Blue light call boxes' },
  { id: 'demo-events', label: 'Events', description: 'Happening in the next 48 hours' },
  { id: 'demo-transit', label: 'Parking and bikes', description: 'Garages, lots and racks' },
] as const

export const demoLayerDefaults: Record<string, boolean> = {
  'demo-safety': false,
  'demo-bluelights': true,
  'demo-events': true,
  'demo-transit': true,
}

/** Fake risk blobs for the safety heat toggle: [x, y, radius, score]. */
export const demoRiskBlobs: [number, number, number, number][] = [
  [560, 860, 110, 0.72],
  [1080, 980, 140, 0.55],
  [720, 640, 160, 0.12],
  [900, 520, 120, 0.2],
  [1180, 520, 120, 0.38],
]
