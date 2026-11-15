/**
 * Pure builders for the demo overlays: GeoJSON for MapLibre sources, and the
 * pin list for HTML markers. No MapLibre import; colours come in resolved.
 */
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson'
// DEMO: sample places, routes and heat. Replace with adapters when the backend serves them.
import { buildings, demoLayers, events, pois, type DemoLayerIcon } from '@/demo'
import type { Id, LngLat, Poi, Route, Selection } from '@/domain'
import { riskBand } from '@/lib/risk'
import { aheadPieces, clip, splitAt } from './routeLine'

/** Resolved risk colours, index = band level - 1. */
export type RiskPalette = readonly [string, string, string, string, string]
export const riskFill = (score: number, palette: RiskPalette) => palette[riskBand(score).level - 1]!

export interface ShownRoutes {
  chosen: Route | null
  others: Route[]
}

/**
 * Routes to draw. A started route (`activeRouteId`) alone, or nothing if it
 * is not among the current routes. Otherwise only in the directions view: the
 * route for the chosen kind, plus the alternative dimmed.
 */
export function shownRoutes(routes: Route[], opts: { activeRouteId: Id | null; directions: boolean; routeKind: Route['kind'] }): ShownRoutes {
  if (opts.activeRouteId) return { chosen: routes.find((r) => r.id === opts.activeRouteId) ?? null, others: [] }
  if (!opts.directions) return { chosen: null, others: [] }
  const chosen = routes.find((r) => r.kind === opts.routeKind) ?? null
  return { chosen, others: routes.filter((r) => r !== chosen) }
}

type RouteProps = { role: 'alt' | 'done' | 'casing' | 'segment'; color?: string; label?: string }

/**
 * Route lines. With `progressM` (navigating), the chosen route splits there:
 * the travelled part is one dimmed `done` line, the remaining part keeps the
 * casing and the risk-coloured segments.
 */
export function routeFeatures({ chosen, others }: ShownRoutes, palette: RiskPalette, progressM: number | null = null): FeatureCollection<LineString, RouteProps> {
  const line = (path: LngLat[], props: RouteProps): Feature<LineString, RouteProps> => ({
    type: 'Feature',
    properties: props,
    geometry: { type: 'LineString', coordinates: path },
  })
  const p = progressM ?? 0
  const { done, ahead } = chosen ? splitAt(chosen.path, p) : { done: [], ahead: [] }
  const segments = chosen ? (p > 0 ? aheadPieces(chosen.segments, p) : chosen.segments) : []
  const features = [
    ...others.map((r) => line(r.path, { role: 'alt' })),
    ...(done.length >= 2 ? [line(done, { role: 'done' })] : []),
    ...(ahead.length >= 2 ? [line(ahead, { role: 'casing' })] : []),
    ...segments.map((s) => line(s.path, { role: 'segment', color: riskFill(s.score, palette), label: riskBand(s.score).label })),
  ]
  return { type: 'FeatureCollection', features }
}

type NavProps = { role: 'ahead' | 'step' | 'destination'; maneuver?: string }

/**
 * Navigation furniture on the started route: the remaining line (carries the
 * direction arrows), dots at the maneuvers still ahead, and the destination.
 */
export function navFeatures(route: Route, progressM: number): FeatureCollection<LineString | Point, NavProps> {
  const ahead = clip(route.path, progressM, Infinity)
  const end = route.path.at(-1)
  const features: Feature<LineString | Point, NavProps>[] = []
  if (ahead.length >= 2) features.push({ type: 'Feature', properties: { role: 'ahead' }, geometry: { type: 'LineString', coordinates: ahead } })
  for (const s of route.steps)
    if (s.offsetM > progressM && s.maneuver !== 'depart' && s.maneuver !== 'arrive' && s.maneuver !== 'straight')
      features.push({ type: 'Feature', properties: { role: 'step', maneuver: s.maneuver }, geometry: { type: 'Point', coordinates: s.at } })
  if (end) features.push({ type: 'Feature', properties: { role: 'destination' }, geometry: { type: 'Point', coordinates: end } })
  return { type: 'FeatureCollection', features }
}

export function heatFeatures(cells: { cell: string; score: number; boundary: LngLat[] }[], palette: RiskPalette): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: cells.map((c) => ({
      type: 'Feature',
      id: c.cell,
      properties: { cell: c.cell, score: c.score, color: riskFill(c.score, palette), label: riskBand(c.score).label },
      geometry: { type: 'Polygon', coordinates: [c.boundary] },
    })),
  }
}

/** Demo building footprints (tap targets and the selected ring). */
export function placeFeatures(selectedId: Id | null): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: buildings.map((b) => ({
      type: 'Feature',
      properties: { id: b.id, selected: b.id === selectedId },
      geometry: { type: 'Polygon', coordinates: b.footprint.type === 'Polygon' ? b.footprint.coordinates : b.footprint.coordinates[0]! },
    })),
  }
}

export interface PinSpec {
  key: string
  lngLat: LngLat
  label: string
  kind: 'building' | 'poi' | 'event' | 'origin'
  type: string
  selection?: Selection
  selected: boolean
}

const layerByIcon = (icon: DemoLayerIcon) => demoLayers.find((l) => l.icon === icon)?.id ?? null

function poiLayer(p: Poi): string | null {
  if (p.type === 'blue_light') return layerByIcon('phone')
  if (p.type === 'parking' || p.type === 'bike_rack') return layerByIcon('parking')
  return null
}

/** Pins for the demo places, filtered by the demo layer toggles. Selected pin last so it paints on top. */
export function pinSpecs(origin: LngLat, selectedId: Id | null, isOn: (layerId: string) => boolean): PinSpec[] {
  const out: PinSpec[] = [{ key: 'origin', lngLat: origin, label: 'Your location', kind: 'origin', type: 'origin', selected: false }]
  for (const p of pois) {
    const layer = poiLayer(p)
    if (layer && !isOn(layer)) continue
    out.push({ key: p.id, lngLat: p.lngLat, label: p.name ?? p.type, kind: 'poi', type: p.type, selected: selectedId === p.id, selection: { kind: 'poi', id: p.id } })
  }
  const eventsLayer = layerByIcon('events')
  if (!eventsLayer || isOn(eventsLayer))
    for (const e of events) {
      const b = buildings.find((x) => x.id === e.buildingId)
      if (!b) continue
      // Beside the building label, offset to the north east corner.
      const ring = b.footprint.type === 'Polygon' ? b.footprint.coordinates[0]! : b.footprint.coordinates[0]![0]!
      const ne: LngLat = [Math.max(...ring.map((p) => p[0]!)), Math.max(...ring.map((p) => p[1]!))]
      out.push({ key: e.id, lngLat: ne, label: e.title, kind: 'event', type: 'event', selected: selectedId === e.id, selection: { kind: 'event', id: e.id } })
    }
  for (const b of buildings)
    out.push({ key: b.id, lngLat: b.centroid, label: b.name, kind: 'building', type: 'building', selected: selectedId === b.id, selection: { kind: 'building', id: b.id } })
  return out.sort((a, b) => Number(a.selected) - Number(b.selected))
}

/** Points the camera should frame: the shown route (plus its destination footprint), else the selected place. */
export function fitPoints(routes: ShownRoutes, selection: Selection | null): { kind: 'route' | 'place'; points: LngLat[] } | null {
  const building = selection ? buildings.find((b) => b.id === selection.id) : undefined
  const footprint = building ? (building.footprint.type === 'Polygon' ? building.footprint.coordinates[0]! : building.footprint.coordinates[0]![0]!) : []
  const fp = footprint.map((p) => [p[0]!, p[1]!] as LngLat)
  if (routes.chosen) return { kind: 'route', points: [routes.chosen, ...routes.others].flatMap((r) => r.path).concat(fp) }
  if (!selection) return null
  if (fp.length) return { kind: 'place', points: fp }
  const poi = pois.find((p) => p.id === selection.id)
  if (poi) return { kind: 'place', points: [poi.lngLat] }
  const event = events.find((e) => e.id === selection.id)
  const host = event && buildings.find((b) => b.id === event.buildingId)
  return host ? { kind: 'place', points: [host.centroid] } : null
}
