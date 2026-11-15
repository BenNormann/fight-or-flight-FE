/**
 * Domain types. Ours, stable, and the ONLY shapes UI and map code may depend on.
 * Backend response shapes live in src/api/adapters and are converted to these.
 * Changing a type here is a supervisor-reviewed change.
 */
import type { MultiPolygon, Polygon } from 'geojson'

export type Id = string
export type LngLat = [lng: number, lat: number]
/** [west, south, east, north] */
export type BBox = [west: number, south: number, east: number, north: number]
/** ISO-8601 */
export type IsoTime = string

// ── Config & capabilities ────────────────────────────────────────────────────

/** A feature the backend may or may not serve. UI gates on these. */
export const CAPABILITY_KEYS = [
  'buildings',
  'rooms',
  'search',
  'pois',
  'risk',
  'routing',
  'events',
  'models3d',
  /** Sign-in (session, `/login`). Off: no account button, directions are not gated. */
  'auth',
  /** Posting the signed-in user's location. */
  'liveLocation',
] as const
export type CapabilityKey = (typeof CAPABILITY_KEYS)[number]
export type Capabilities = Record<CapabilityKey, boolean>

/** Whatever the backend serves for the basemap. Built into a style by src/map/basemap.ts. */
export type BasemapConfig =
  | { kind: 'style'; url: string }
  | { kind: 'vector'; tiles: string[]; minZoom?: number; maxZoom?: number; attribution?: string }
  | { kind: 'raster'; tiles: string[]; tileSize?: number; maxZoom?: number; attribution?: string }
  | { kind: 'pmtiles'; url: string; attribution?: string }

/** Range tiers. Nothing about range is hard-coded in the FE. */
export interface CampusBounds {
  /** Full detail: buildings, rooms, POIs, 3D. */
  campus: BBox
  /** Walking safety: risk + routing. Falls back to `campus`. */
  walk: BBox
  /** Basemap + ride links. Falls back to `walk`. */
  ride: BBox
}

export interface AppConfig {
  bounds: CampusBounds
  center: LngLat
  basemap: BasemapConfig
  capabilities: Capabilities
  /** H3 resolutions the backend serves risk at, coarse → fine. */
  riskResolutions: number[]
  dataUpdatedAt?: IsoTime
}

// ── Account & live location ──────────────────────────────────────────────────

export interface User {
  id: Id
  email: string
  name?: string
  picture?: string
}

/** One device position the signed-in user shares. */
export interface LocationFix {
  lngLat: LngLat
  accuracyM: number
  headingDeg?: number
  speedMps?: number
  at: IsoTime
}

// ── Campus entities ──────────────────────────────────────────────────────────

export interface Entrance {
  id: Id
  lngLat: LngLat
  name?: string
  accessible?: boolean
}

export interface Building {
  id: Id
  code: string
  name: string
  footprint: Polygon | MultiPolygon
  centroid: LngLat
  floors?: number
  heightM?: number
  entrances: Entrance[]
  address?: string
}

export interface Room {
  id: Id
  buildingId: Id
  name: string
  /** Display label, e.g. "B1", "G", "3". */
  floor: string
  type?: string
  capacity?: number
}

export const POI_TYPES = ['blue_light', 'dps', 'entrance', 'bike_rack', 'seating'] as const
export type PoiType = (typeof POI_TYPES)[number]

export interface Poi {
  id: Id
  /** Known types get icons; unknown strings still render with a generic pin. */
  type: PoiType | (string & {})
  lngLat: LngLat
  name?: string
}

export interface CampusEvent {
  id: Id
  title: string
  start: IsoTime
  end?: IsoTime
  location?: string
  buildingId?: Id
  lngLat?: LngLat
  url?: string
}

// ── Places (businesses, campus buildings and points the backend's search knows) ─

export interface Place {
  id: Id
  /** `place`, `building`, `poi`, `address`; open-ended. */
  kind: string
  name: string
  /** Top-level category id (see `PlaceCategory`). */
  category?: string
  subcategory?: string
  address?: string
  lngLat: LngLat
  /** From the point the search was made near. */
  distanceM?: number
  /** 0 to 5. */
  rating?: number
  reviewCount?: number
  openNow?: boolean
}

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
export type Weekday = (typeof WEEKDAYS)[number]

/** One opening interval, local "HH:MM". */
export interface OpenSpan {
  open: string
  close: string
  /** Closes after midnight. */
  overnight?: boolean
  allDay?: boolean
}

export interface PlaceReview {
  text: string
  author?: string
  rating?: number
  /** As the source wrote it, e.g. "2 weeks ago". */
  when?: string
}

export interface PlaceDetail extends Place {
  /** Every weekday present; an empty list is a closed day. Undefined: hours unknown. */
  hours?: Record<Weekday, OpenSpan[]>
  phone?: string
  website?: string
  photoUrl?: string
  description?: string
  /** Other names it is known by, e.g. a building code ("DML"). */
  aliases: string[]
  reviews: PlaceReview[]
}

export interface PlaceCategory {
  id: string
  label: string
  count: number
}

// ── Risk & routing (computed by the backend, only rendered here) ─────────────

export const RISK_FACTORS = ['crime', 'lighting', 'crowd', 'weather'] as const
export type RiskFactor = (typeof RISK_FACTORS)[number]

export interface RiskCell {
  h3: string
  /** 0 (safest) to 1 (riskiest). */
  score: number
  factors: Partial<Record<RiskFactor, number>>
}

export type RouteKind = 'safest' | 'fastest'

export interface RouteSegment {
  path: LngLat[]
  score: number
}

export const MANEUVERS = [
  'depart',
  'straight',
  'slight-left',
  'left',
  'sharp-left',
  'slight-right',
  'right',
  'sharp-right',
  'u-turn',
  'arrive',
] as const
export type Maneuver = (typeof MANEUVERS)[number]

/** One turn-by-turn instruction. Comes with the route (backend, or demo data); the FE only renders it. */
export interface RouteStep {
  maneuver: Maneuver
  /** Where the maneuver happens. */
  at: LngLat
  /** Distance from the start of the route to `at`, along the path. */
  offsetM: number
  /** Length of the leg that follows this maneuver. */
  distanceM: number
  /** Street or path the leg follows, when known. */
  name?: string
}

export interface Route {
  id: Id
  kind: RouteKind
  path: LngLat[]
  durationS: number
  distanceM: number
  risk: { mean: number; max: number }
  segments: RouteSegment[]
  warnings: string[]
  /** Good things about this route worth one line, e.g. "Passes 9 emergency phones". */
  highlights?: string[]
  /** Turn-by-turn steps in travel order. Empty when the source gives none: then no turn banner. */
  steps: RouteStep[]
}

/** Live progress along a started route. One writer (the navigation driver), many readers. */
export interface NavProgress {
  /** Position snapped to the route. */
  position: LngLat
  /** Direction of travel, degrees clockwise from north. */
  headingDeg: number
  /** Distance travelled along the route. */
  progressM: number
  /** Index into `Route.steps` of the NEXT maneuver. */
  stepIndex: number
  /** Distance to that maneuver. */
  toStepM: number
  remainingM: number
  remainingS: number
  arrived: boolean
}

/** Marker drawn at the traveller's position. More characters come later; ids are open-ended. */
export type NavCharacterId = 'chevron' | (string & {})

export interface RouteRequest {
  from: LngLat
  to: LngLat
  /** Departure time; omitted means now. */
  at?: IsoTime
}

// ── Search & selection ───────────────────────────────────────────────────────

export type EntityKind = 'building' | 'room' | 'poi' | 'event' | 'place'

export interface SearchResult {
  kind: EntityKind
  id: Id
  label: string
  sublabel?: string
  /** Short trailing text, e.g. a distance. */
  meta?: string
  lngLat?: LngLat
}

/** The one value that drives the bottom sheet. Tapping anything sets it. */
export type Selection =
  | { kind: EntityKind; id: Id }
  | { kind: 'riskCell'; id: string }
  | { kind: 'route'; id: Id }

export type MapMode = '2d' | 'iso' | '3d'
export type SheetSnap = 'peek' | 'half' | 'full'
