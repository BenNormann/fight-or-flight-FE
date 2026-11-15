import 'maplibre-gl/dist/maplibre-gl.css'
import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap, MapMouseEvent } from 'maplibre-gl'
// MapLibre 6 spawns a module worker next to its own file, which Vite's dep prebundling does not copy.
// Bundle the worker ourselves and point MapLibre at it.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { animate, motion, useReducedMotion } from 'motion/react'
import { Protocol } from 'pmtiles'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAppConfig, useDemoIncidents, useDemoStatus } from '@/api/queries'
// DEMO: sample places, routes and heat at real coordinates. Replace with adapters when the backend serves them.
import { CAMPUS_CENTER, ORIGIN, buildings, demoLayerDefaults, SAFETY_HEAT_LAYER } from '@/demo'
import { demoRiskCells } from '@/demo/heat'
import type { AppConfig, BBox, LngLat, MapMode } from '@/domain'
import { env } from '@/lib/env'
import { LOCATION_DENIED_HELP, getLocation, requestLocation } from '@/lib/geo/location'
import { pinId } from '@/lib/pin'
import { useAppStore } from '@/state/store'
import { useAmbientPlaces, useMapPlaces } from '@/state/places'
import { useMyPosition, useTrip } from '@/state/trip'
import { Keystone, PlaceIcon, notify, useBreakpoint, useTheme, useViewportHeight } from '@/ui'
import { DEV_FALLBACK_STYLE, buildMapStyle, type MapTheme } from './basemap'
import { backendBuildingsAvailable, backendBuildingsUrl, basemapBuildings, growWithZoom, pmtilesBuildings, type BuildingSource } from './buildings'
import {
  BUILDINGS_EXTRUDE_ZOOM,
  BUILDINGS_TILE_MIN_ZOOM,
  BUILDINGS_FADE_IN_ZOOM,
  TILE_LOD,
  BUILDINGS_MIN_ZOOM,
  LOCATE_ZOOM,
  MAX_PITCH,
  MAX_ZOOM,
  MIN_ZOOM,
  START_ZOOM,
  bboxOf,
  boundsAround,
  cameraPresets,
} from './camera'
import { characterFeatures, characterFor, lerpAngle, lerpLngLat, type CharacterColors } from './characters'
import { followTraveller as resumeFollow, publishBearing, publishCentredOnUser, registerMapController } from './controller'
import { DEMO_INCIDENT_RED, DEMO_INCIDENT_SOURCE, demoIncidentFeatures } from './demoIncidents'
import { floorHopFeatures } from './floorHop'
import { PHONE_POINTS, phonePoleFeatures } from './phonePoles'
import { CAMPUS_AREA, zoneAreas, zoneOutlines } from './zones'
import { POI_LAYER, POI_SOURCE, labelBlocks, gridCells, installPoiIcons, poiFeatures } from './poiIcons'
import { chromeInsets } from './insets'
import { installTouchTilt } from './touchTilt'
import { fitPoints, heatFeatures, navFeatures, pinSpecs, placeFeatures, routeFeatures, placePins, shownRoutes, tripPins, type PinSpec, type RiskPalette } from './overlays'

/**
 * The ONLY map instance in the app: MapLibre GL over a basemap from config
 * (`basemap.ts`), extruded buildings (`buildings.ts`), and the demo overlays
 * (`overlays.ts`) as GeoJSON layers plus HTML pin markers. Pan and zoom in
 * every mode; 3D also rotates and pitches. The camera keeps targets inside the
 * part of the map not covered by chrome (`insets.ts`).
 */

const EASE_SETTLE = [0.22, 1, 0.36, 1] as const
const EASE_EMPHASIS = [0.34, 1.3, 0.64, 1] as const
const CAMERA_MS = 800
const EMPTY = { type: 'FeatureCollection' as const, features: [] }

/** Demo campus extent for the first view. */
const CAMPUS_POINTS = buildings.map((b) => b.centroid)

const FALLBACK_CONFIG: Pick<AppConfig, 'basemap' | 'center'> = { basemap: { kind: 'style', url: DEV_FALLBACK_STYLE }, center: CAMPUS_CENTER }

let pmtilesProtocol = false
function setupMapLibre() {
  if (pmtilesProtocol) return
  maplibregl.setWorkerUrl(maplibreWorkerUrl)
  maplibregl.addProtocol('pmtiles', new Protocol().tile)
  pmtilesProtocol = true
}

/** Token colours resolved for the current theme (MapLibre cannot read CSS variables). */
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
/** Building colour: campus buildings (touching the campus area) get their own tint, the rest the plain one. */
const buildingColor = (): ExpressionSpecification => ['case', ['<=', ['distance', CAMPUS_AREA], 0], cssVar('--map-building-campus'), cssVar('--map-building')]
const riskPalette = (): RiskPalette => [1, 2, 3, 4, 5].map((i) => cssVar(`--risk-${i}`)) as unknown as RiskPalette
/** Same rule as the "you are here" dot: cardinal by day, gold at night. */
const characterColors = (theme: MapTheme): CharacterColors =>
  theme === 'dark' ? { body: cssVar('--gold'), accent: cssVar('--brand') } : { body: cssVar('--brand'), accent: cssVar('--gold') }

/** Follow camera: north-up in 2D and Iso (their fixed bearing), heading-up in 3D. */
const followBearing = (mode: MapMode, headingDeg: number) => (mode === '3d' ? headingDeg : cameraPresets[mode].bearing)

const NO_CELLS: BBox[] = []

/** The "Emergency phones" toggle in Map layers. */
const PHONES_TOGGLE = 'demo-bluelights'
/** Poles are drawn from this zoom; further out they would be a smear of dots. */
const PHONES_MIN_ZOOM = 16
/** Blue light blue: the lamp, and the glow at the pole's foot. */
const PHONE_BLUE = '#4aa3ff'
const PHONE_BOX_BLUE = '#1f6fe0'
/** A new result list frames this many of its nearest places, not the whole list (which can span miles). */
const FRAME_RESULTS = 8

/** Within this distance of the user, the map counts as centred on them. */
const RECENTER_TOGGLE_M = 40
const metresApart = (a: LngLat, b: LngLat) => Math.hypot((b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180), b[1] - a[1]) * 111_320

/** A tap this close to the traveller counts as a tap on it (a finger, not a cursor). */
const TRAVELLER_TAP_PX = 36

/** Longest glide between two fixes; a longer gap jumps. */
const NAV_GLIDE_MAX_MS = 1500
const NAV_JUMP_AFTER_MS = 3000

/** Where the traveller is drawn: eased between fixes. */
interface TravellerPose {
  at: LngLat
  headingDeg: number
  progressM: number
}

const onResize = (cb: () => void) => {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}
const useViewportWidth = () => useSyncExternalStore(onResize, () => window.innerWidth, () => 390)

/** Wait for the config (mock or live); fall back to the public style if the backend is unreachable. */
export function MapView() {
  const config = useAppConfig()
  if (config.isPending) return <div className="absolute inset-0 bg-map-land" data-testid="map" />
  return <MapLibreView config={config.data ?? FALLBACK_CONFIG} />
}

function MapLibreView({ config }: { config: Pick<AppConfig, 'basemap' | 'center'> }) {
  const mapMode = useAppStore((s) => s.mapMode)
  const selection = useAppStore((s) => s.selection)
  const select = useAppStore((s) => s.select)
  const overrides = useAppStore((s) => s.layerOverrides)
  const panelOpen = useAppStore((s) => s.panelOpen)
  const sheetSnap = useAppStore((s) => s.sheetSnap)
  const origin = useAppStore((s) => s.origin)
  const picking = useAppStore((s) => s.picking)
  // The planned route stays drawn while the user changes the map view from the layers panel.
  const planning = useAppStore((s) => s.view === 'directions' || (s.view === 'layers' && s.layersOverDirections))
  const trip = useTrip()
  const mapPlaces = useMapPlaces()
  /** Map cells whose places are labelled; empty while zoomed out. Fixed squares, so moving the map reuses them. */
  const [poiCells, setPoiCells] = useState<BBox[]>(NO_CELLS)
  const [poiBlocks, setPoiBlocks] = useState(2)
  /** A category chip is active (no typed query): the map shows that category only, highlighted, like the list beside it. */
  // Still on while one of its places is open, so picking from the list does not bring everything else back.
  const browsing = useAppStore((s) => ((s.view === 'search' || s.view === 'place') && !s.query.trim() ? s.category : null))
  const ambient = useAmbientPlaces(poiCells, poiBlocks, mapPlaces.live ? browsing : null)
  const me = useMyPosition()
  const routeKind = useAppStore((s) => s.routeKind)
  const activeRouteId = useAppStore((s) => s.activeRouteId)
  const nav = useAppStore((s) => s.nav)
  const navFollowing = useAppStore((s) => s.navFollowing)
  const navCharacter = useAppStore((s) => s.navCharacter)
  const breakpoint = useBreakpoint()
  const viewportH = useViewportHeight()
  const viewportW = useViewportWidth()
  const theme: MapTheme = useTheme().resolved
  const reduce = useReducedMotion() ?? false

  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MlMap | null>(null)
  /** Bumps on every style load: custom sources and layers must be re-added after `setStyle`. */
  const [styleGen, setStyleGen] = useState(0)
  /** True between `setStyle` and its `style.load`: the style is not usable yet. */
  const swapping = useRef(false)
  const styleGenRef = useRef(0)
  useEffect(() => {
    styleGenRef.current = styleGen
  }, [styleGen])
  const [buildingSrc, setBuildingSrc] = useState<'pending' | 'basemap' | string>('pending')

  const live = useRef({ mapMode, reduce, me })
  useEffect(() => {
    live.current = { mapMode, reduce, me }
  }, [mapMode, reduce, me])

  const on = (id: string) => overrides[id] ?? demoLayerDefaults[id] ?? false
  const heatOn = on(SAFETY_HEAT_LAYER)
  const selectedId = selection?.id ?? null
  /** Real places are on the map: the sample campus pins step aside. */
  const livePlaces = mapPlaces.live
  const ms = reduce ? 0 : CAMERA_MS

  // ── Create the one map ────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setupMapLibre()
    const preset = cameraPresets[useAppStore.getState().mapMode]
    const m = new maplibregl.Map({
      container: el,
      style: buildMapStyle(config.basemap, theme, !env.mapStyleUrl),
      center: config.center,
      zoom: START_ZOOM,
      pitch: preset.pitch,
      bearing: preset.bearing,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxPitch: MAX_PITCH,
      maxBounds: boundsAround(config.center),
      renderWorldCopies: false,
      attributionControl: { compact: true },
      // Two-finger tilt is ours (touchTilt.ts): MapLibre's gives up on real, imperfect fingers.
      touchPitch: false,
      fadeDuration: live.current.reduce ? 0 : 300,
    })
    m.on('style.load', () => {
      swapping.current = false
      setStyleGen((g) => g + 1)
    })
    m.setSourceTileLodParams(TILE_LOD.maxZoomLevelsOnScreen, TILE_LOD.tileCountMaxMinRatio)
    m.on('rotate', () => publishBearing(m.getBearing()))
    m.on('zoom', () => syncBuildings(m, useAppStore.getState().mapMode))
    // 3D only: two fingers moving together vertically tilt. 2D and Iso: two fingers zoom.
    const removeTilt = installTouchTilt(m, () => cameraPresets[useAppStore.getState().mapMode].rotate)
    // Dev only: lets local gesture checks read the camera.
    if (import.meta.env.DEV) (window as unknown as { __fofMap?: MlMap }).__fofMap = m
    setMap(m)

    const url = backendBuildingsUrl()
    if (url) void backendBuildingsAvailable(url).then((ok) => setBuildingSrc(ok ? url : 'basemap'))
    else setBuildingSrc('basemap')

    return () => {
      removeTilt()
      m.remove()
      setMap(null)
    }
    // Created once; theme and basemap changes go through setStyle below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Theme or basemap change: swap the style; overlays are re-added on style.load.
  const styleKey = JSON.stringify([config.basemap, theme])
  const firstStyle = useRef(styleKey)
  useEffect(() => {
    if (!map || styleKey === firstStyle.current) return
    firstStyle.current = styleKey
    // Until style.load fires, the old layers are gone: overlay effects must not touch the map.
    swapping.current = true
    map.setStyle(buildMapStyle(config.basemap, theme, !env.mapStyleUrl), { diff: false })
  }, [map, styleKey, config.basemap, theme])

  // ── Overlays: (re)install after each style load ────────────────────────────
  useEffect(() => {
    if (!map || !styleGen || buildingSrc === 'pending') return
    installLayers(map, buildingSrc === 'basemap' ? basemapBuildings(map.getStyle()) : pmtilesBuildings(buildingSrc))
    // After a style (re)load: restore layers and handlers, but never the camera pose.
    applyMode(map, live.current.mapMode, 0, true)
  }, [map, styleGen, buildingSrc])

  const routes = useMemo(
    () => shownRoutes(trip.routes, { activeRouteId, directions: planning, routeKind }),
    [trip.routes, activeRouteId, planning, routeKind],
  )
  const ready = !!map && styleGen > 0 && buildingSrc !== 'pending'
  /** The started route, while it is among the current routes. */
  const navRoute = activeRouteId ? routes.chosen : null
  /** Navigating with live fixes: the follow camera owns the view, not the route fit. */
  const navLive = !!navRoute && !!nav

  // ── Route line, nav furniture and traveller ───────────────────────────────
  /** The traveller as drawn right now (eased between fixes). */
  const traveller = useRef<TravellerPose | null>(null)
  /** Redraws everything that depends on the traveller. Rebuilt after each render so it reads current props. */
  const drawNav = useRef<() => void>(() => {})
  useEffect(() => {
    drawNav.current = () => {
      if (!ready || swapping.current) return
      const t = traveller.current
      const progress = navRoute ? (t?.progressM ?? 0) : null
      setData(map, 'fof-routes', routeFeatures(routes, riskPalette(), progress, { from: trip.from?.lngLat, to: trip.to?.lngLat }))
      setData(map, 'fof-nav', navRoute ? navFeatures(navRoute, progress ?? 0) : EMPTY)
      if (!navRoute || !t) {
        setData(map, 'fof-nav-char', EMPTY)
        return
      }
      const colors = characterColors(theme)
      const body = characterFeatures(characterFor(navCharacter), { at: t.at, headingDeg: t.headingDeg, progressM: t.progressM }, { zoom: map.getZoom(), mode: mapMode }, colors)
      // Halo under the character: flat, drawn above the buildings, so the position shows even when a wall hides the 3D arrow.
      const halo = { type: 'Feature' as const, properties: { role: 'halo', color: colors.body }, geometry: { type: 'Point' as const, coordinates: t.at } }
      setData(map, 'fof-nav-char', { type: 'FeatureCollection', features: [halo, ...body.features] })
    }
  })

  useEffect(() => {
    if (!ready || swapping.current) return
    drawNav.current()
    const bg = cssVar('--background')
    const muted = cssVar('--muted-foreground')
    map.setPaintProperty('fof-route-casing', 'line-color', bg)
    map.setPaintProperty('fof-route-alt', 'line-color', muted)
    map.setPaintProperty('fof-route-link', 'line-color', cssVar('--foreground'))
    map.setPaintProperty('fof-route-done-casing', 'line-color', bg)
    map.setPaintProperty('fof-route-done', 'line-color', muted)
    map.setPaintProperty('fof-nav-step', 'circle-color', bg)
    map.setPaintProperty('fof-nav-step', 'circle-stroke-color', cssVar('--foreground'))
    map.setPaintProperty('fof-nav-dest', 'circle-color', cssVar('--brand'))
    map.setPaintProperty('fof-nav-dest', 'circle-stroke-color', bg)
    map.setPaintProperty('fof-nav-dest-dot', 'circle-color', bg)
    map.setPaintProperty('fof-nav-char-casing', 'line-color', bg)
  }, [ready, map, styleGen, routes, theme, mapMode, navCharacter, navRoute])

  // The character keeps a constant on-screen size: rescale it with the zoom.
  useEffect(() => {
    if (!map) return
    let frame = 0
    const onZoom = () => {
      if (!traveller.current || frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        drawNav.current()
      })
    }
    map.on('zoom', onZoom)
    return () => {
      cancelAnimationFrame(frame)
      map.off('zoom', onZoom)
    }
  }, [map])

  // ── Up the building: the destination room's floor, and the storeys to climb to it ──
  const toFloor = trip.to?.floor
  const toAt = trip.to?.lngLat
  const routeEnd = routes.chosen?.path.at(-1)
  useEffect(() => {
    if (!ready || swapping.current) return
    const clear = () => setData(map, 'fof-floor', EMPTY)
    // Needs a room on a floor above ground, a route to its building, and walls to climb (not the flat 2D map).
    if (toFloor === undefined || toFloor < 1 || !toAt || !routeEnd || mapMode === '2d') return clear()
    map.setPaintProperty('fof-floor', 'fill-extrusion-color', cssVar('--selected'))
    const draw = () => {
      // The building under the destination, from whichever building layer is showing.
      const hit = map
        .queryRenderedFeatures(map.project(toAt), { layers: ['fof-buildings', 'fof-buildings-flat'].filter((id) => map.getLayer(id)) })
        .find((f) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
      if (!hit) return false
      const g = hit.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
      const ring = (g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0]?.[0]) ?? []
      const p = hit.properties as Record<string, unknown>
      const heightM = [p.height_m, p.render_height, p.height].find((v): v is number => typeof v === 'number' && v > 0) ?? 12
      setData(map, 'fof-floor', floorHopFeatures(ring.map((c) => [c[0]!, c[1]!] as LngLat), heightM, toFloor, routeEnd))
      return true
    }
    // The building's tile may still be loading, or off screen until the camera has framed the route.
    if (draw()) return
    clear()
    const retry = () => {
      if (draw()) map.off('idle', retry)
    }
    map.on('idle', retry)
    return () => void map.off('idle', retry)
    // `toAt` and `routeEnd` are compared by value below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, map, styleGen, toFloor, toAt?.[0], toAt?.[1], routeEnd?.[0], routeEnd?.[1], mapMode, theme])

  // Emergency phone poles follow the "Emergency phones" switch in Map layers. 2D has no solids: only the glow shows.
  const phonesOn = on(PHONES_TOGGLE)
  useEffect(() => {
    if (!ready || swapping.current || !map.getLayer('fof-phone-poles')) return
    map.setLayoutProperty('fof-phones-glow', 'visibility', phonesOn ? 'visible' : 'none')
    const show = phonesOn && mapMode !== '2d'
    setData(map, 'fof-phone-poles', show ? phonePoleFeatures({ post: cssVar('--muted-foreground'), box: PHONE_BOX_BLUE, lamp: PHONE_BLUE }) : EMPTY)
  }, [ready, map, styleGen, phonesOn, mapMode, theme])

  // Demo mode: simulated crimes and the area routes avoid around each (only polled with ?demo).
  const demoIncidents = useDemoIncidents().data
  const avoidRadiusM = useDemoStatus().data?.avoidRadiusM ?? 120
  useEffect(() => {
    if (!ready || swapping.current || !map.getSource(DEMO_INCIDENT_SOURCE)) return
    setData(map, DEMO_INCIDENT_SOURCE, demoIncidents?.length ? demoIncidentFeatures(demoIncidents, avoidRadiusM) : EMPTY)
  }, [ready, map, styleGen, demoIncidents, avoidRadiusM])

  // Which area to label follows the camera, once it rests.
  useEffect(() => {
    if (!map) return
    const update = () => {
      const b = map.getBounds()
      const next = gridCells([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], map.getZoom())
      setPoiBlocks(labelBlocks(map.getZoom()))
      const key = (cells: BBox[]) => cells.map((c) => c.join(',')).sort().join('|')
      setPoiCells((prev) => (key(prev) === key(next) ? prev : next))
    }
    update()
    map.on('moveend', update)
    return () => void map.off('moveend', update)
  }, [map])

  // Place names and icons in the map. Results and the selection are pins already: not drawn twice.
  useEffect(() => {
    if (!ready || swapping.current) return
    // While browsing a category its places are these icons, not pins; only the selected place is a pin.
    const pinned = new Set((browsing ? (mapPlaces.selected ? [mapPlaces.selected] : []) : mapPlaces.places).map((p) => p.id))
    setData(map, POI_SOURCE, poiCells.length ? poiFeatures(ambient, pinned, !!browsing) : EMPTY)
    // Browsing: every match keeps its icon even where they crowd. Otherwise icons give way until close in.
    map.setLayoutProperty(POI_LAYER, 'icon-allow-overlap', browsing ? true : ['step', ['zoom'], false, 17, true])
    map.setPaintProperty(POI_LAYER, 'text-color', cssVar('--map-label'))
    map.setPaintProperty(POI_LAYER, 'text-halo-color', cssVar('--map-label-halo'))
  }, [ready, map, styleGen, ambient, poiCells, mapPlaces.places, mapPlaces.selected, browsing, theme])

  // Category icons are images in the style: redraw them for each style (theme) load.
  useEffect(() => {
    if (!ready || swapping.current) return
    const gen = styleGen
    void installPoiIcons(map, // Light disc on the night map, dark disc by day: the icons must stand out from the buildings under them.
      { disc: cssVar('--foreground'), glyph: cssVar('--background'), ring: cssVar('--background') }, () => !swapping.current && gen === styleGenRef.current)
    // The highlighted set, for the category being browsed: cardinal by day, gold at night.
    void installPoiIcons(map, { disc: cssVar('--selected'), glyph: cssVar('--selected-foreground'), ring: cssVar('--background') }, () => !swapping.current && gen === styleGenRef.current, true)
  }, [ready, map, styleGen])

  const heat = useMemo(() => demoRiskCells(), [])
  useEffect(() => {
    if (!ready || swapping.current) return
    setData(map, 'fof-heat', heatOn ? heatFeatures(heat, riskPalette()) : EMPTY)
  }, [ready, map, styleGen, heatOn, heat, theme])

  useEffect(() => {
    if (!ready || swapping.current) return
    // Sample footprints (tap targets) only while the places are sample data.
    setData(map, 'fof-places', livePlaces ? EMPTY : placeFeatures(selectedId))
    map.setPaintProperty('fof-place-casing', 'line-color', cssVar('--background'))
    map.setPaintProperty('fof-place-ring', 'line-color', cssVar('--selected'))
    if (map.getLayer('fof-buildings')) {
      map.setPaintProperty('fof-buildings', 'fill-extrusion-color', buildingColor())
      map.setPaintProperty('fof-buildings-flat', 'fill-color', buildingColor())
    }
    if (map.getLayer('fof-zone-campus')) {
      map.setPaintProperty('fof-zone-campus', 'line-color', cssVar('--brand-ink'))
      map.setPaintProperty('fof-zone-dps', 'line-color', cssVar('--map-label'))
      map.setPaintProperty('fof-zone-fill-campus', 'fill-color', cssVar('--brand-ink'))
      map.setPaintProperty('fof-zone-fill-dps', 'fill-color', cssVar('--map-label'))
    }
  }, [ready, map, styleGen, selectedId, theme, livePlaces])

  // ── Camera mode ──────────────────────────────────────────────────────────
  const appliedMode = useRef<MapMode | null>(null)
  useEffect(() => {
    if (!ready || swapping.current) return
    const keepPose = appliedMode.current === mapMode
    appliedMode.current = mapMode
    applyMode(map, mapMode, ms, keepPose)
  }, [ready, map, mapMode, ms])

  // ── Padding and fit ──────────────────────────────────────────────────────
  const routeActive = activeRouteId !== null
  const insets = useMemo(
    () => chromeInsets({ breakpoint, sheetSnap, panelOpen, routeActive, viewportW, viewportH }),
    [breakpoint, sheetSnap, panelOpen, routeActive, viewportW, viewportH],
  )
  const selectedPlaceKey = mapPlaces.selected ? `${mapPlaces.selected.id}@${mapPlaces.selected.lngLat.join(',')}` : ''
  const resultsKey = mapPlaces.places.slice(0, FRAME_RESULTS).map((p) => p.id).join('|')
  const fit = useMemo(() => {
    const known = fitPoints(routes, selection)
    if (known) return known
    // A backend place: frame it. A fresh list of results (a search, a category): frame the nearest few.
    if (mapPlaces.selected) return { kind: 'place' as const, points: [mapPlaces.selected.lngLat] }
    if (!selection && mapPlaces.places.length) return { kind: 'results' as const, points: mapPlaces.places.slice(0, FRAME_RESULTS).map((p) => p.lngLat) }
    return null
    // Keyed by WHAT is framed, not by object identity: the same place or result list arriving again
    // (detail loaded, a refetch) must not pull the camera back after the user moved it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, selection, selectedPlaceKey, resultsKey])
  const framed = useRef(false)
  const framedMode = useRef<MapMode | null>(null)
  useEffect(() => {
    if (!map || navLive) return
    const w = map.getContainer().clientWidth
    const h = map.getContainer().clientHeight
    // Sheet at full: nothing left to frame into. Leave the camera alone.
    if (w - insets.left - insets.right < 80 || h - insets.top - insets.bottom < 80) return
    // First view with nothing selected: the whole demo campus and "you are here".
    const target = fit ?? (framed.current ? null : { kind: 'campus' as const, points: [ORIGIN, ...CAMPUS_POINTS] })
    // While picking a point the user is aiming the map: do not move it under their finger.
    if (picking && framed.current) return
    framed.current = true
    const box = target && bboxOf(target.points)
    const preset = cameraPresets[mapMode]
    // Ease to the mode's pitch and bearing too, so a mode change in the same render is not cancelled.
    // In a free-rotate mode (3D) the orientation is the user's: opening a sheet, a panel or a view
    // must not turn or tilt the map. Only entering the mode applies its preset.
    const entered = framedMode.current !== mapMode
    framedMode.current = mapMode
    const pose =
      preset.rotate && !entered
        ? { pitch: map.getPitch(), bearing: map.getBearing() }
        : { pitch: preset.pitch, bearing: preset.rotate ? map.getBearing() || preset.bearing : preset.bearing }
    if (!box || !target) {
      map.easeTo({ padding: insets, ...pose, duration: ms })
      return
    }
    const m = target.kind === 'route' ? { x: 32, y: 40 } : target.kind === 'campus' ? { x: 16, y: 16 } : target.kind === 'results' ? { x: 40, y: 56 } : { x: 104, y: 56 } // room for labels and pins
    const padding = { top: insets.top + m.y + 44, bottom: insets.bottom + m.y, left: insets.left + m.x, right: insets.right + m.x }
    const cam = map.cameraForBounds(box, {
      padding,
      absolutePadding: true,
      bearing: pose.bearing,
      // Results: wide enough to take them in as a group, never so tight that two neighbours fill the screen.
      maxZoom: target.kind === 'place' ? Math.max(map.getZoom(), 17) : target.kind === 'results' ? 16.5 : 18,
    })
    if (!cam) return
    // The fit already accounts for padding; keep only the chrome insets as the map's padding.
    map.easeTo({ ...cam, padding: insets, pitch: pose.pitch, duration: target.kind === 'campus' ? 0 : ms })
  }, [map, fit, insets, ms, mapMode, navLive, picking])

  // ── Follow camera ────────────────────────────────────────────────────────
  const follow = useRef({ on: navFollowing && navLive, insets, mapMode })
  useEffect(() => {
    follow.current = { on: navFollowing && navLive, insets, mapMode }
  }, [navFollowing, navLive, insets, mapMode])

  /**
   * The user tilted or rotated while following: keep following the position,
   * but leave bearing and pitch where they put them. Cleared on resume or mode change.
   */
  const userAim = useRef(false)
  /** Set while the camera's latest move is our own jump (its moveend is ignored). */
  const ownJump = useRef(false)
  /** Keep the camera locked on the traveller, unless a gesture or an ease owns it. Refs only, so stable. */
  const lockOn = useCallback(
    (t: { at: LngLat; headingDeg: number }) => {
      const f = follow.current
      if (!map || !f.on || map.isMoving()) return
      ownJump.current = true
      map.jumpTo({ center: t.at, padding: f.insets, ...(userAim.current ? {} : { bearing: followBearing(f.mapMode, t.headingDeg) }) })
    },
    [map],
  )
  /** Ease the camera onto the traveller (start, resume, chrome or mode change). */
  const easeToTraveller = useRef<(duration: number) => void>(() => {})
  useEffect(() => {
    easeToTraveller.current = (duration) => {
      // Aim at the latest fix: the drawn traveller may still be gliding from the previous one.
      const n = useAppStore.getState().nav
      const t = n ? { at: n.position, headingDeg: n.headingDeg } : traveller.current
      if (!ready || swapping.current || !t) return
      const aim = userAim.current ? {} : { bearing: followBearing(mapMode, t.headingDeg), pitch: cameraPresets[mapMode].pitch }
      map.easeTo({ center: t.at, zoom: Math.max(map.getZoom(), LOCATE_ZOOM), ...aim, padding: insets, duration })
    }
  })

  useEffect(() => {
    userAim.current = false
    useAppStore.getState().setNavAimFree(false)
  }, [navFollowing, mapMode])

  useEffect(() => {
    if (navFollowing && navLive) easeToTraveller.current(ms)
  }, [ready, map, navFollowing, navLive, insets, mapMode, ms])

  // Gestures. A pan hands the camera back to the user (follow off); a tilt or
  // rotate only releases bearing and pitch. After any camera movement ends
  // (our ease, a pinch zoom), snap back onto the traveller if still following.
  useEffect(() => {
    if (!map) return
    const navOn = () => {
      const s = useAppStore.getState()
      return !!s.activeRouteId && s.navFollowing
    }
    // A pinch also pans around its centre; only a one-finger (or mouse) drag counts as leaving.
    const onPan = (e: { originalEvent?: unknown }) => {
      const ev = e.originalEvent
      const multiTouch = typeof TouchEvent !== 'undefined' && ev instanceof TouchEvent && ev.touches.length > 1
      if (ev && !multiTouch && navOn()) useAppStore.getState().setNavFollowing(false)
    }
    const onAim = (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent || !navOn()) return
      userAim.current = true
      useAppStore.getState().setNavAimFree(true)
    }
    const onMoveEnd = () => {
      // The moveend of our own jump must not snap again, or we would snap forever.
      if (ownJump.current) {
        ownJump.current = false
        return
      }
      const t = traveller.current
      if (t) lockOn(t)
    }
    const handlers = [
      ['dragstart', onPan],
      ['rotatestart', onAim],
      ['pitchstart', onAim],
      ['moveend', onMoveEnd],
    ] as const
    for (const [type, fn] of handlers) map.on(type, fn)
    return () => {
      for (const [type, fn] of handlers) map.off(type, fn)
    }
  }, [map, lockOn])

  // Each fix: glide the traveller (and the line split) from where it is drawn to the new fix.
  const lastFixAt = useRef(0)
  useEffect(() => {
    if (!navRoute || !nav) {
      traveller.current = null
      lastFixAt.current = 0
      drawNav.current()
      return
    }
    const to: TravellerPose = { at: nav.position, headingDeg: nav.headingDeg, progressM: nav.progressM }
    const from = traveller.current
    const now = performance.now()
    const gap = now - lastFixAt.current
    lastFixAt.current = now
    const step = (pose: TravellerPose) => {
      traveller.current = pose
      drawNav.current()
      lockOn(pose)
    }
    if (!from || reduce || gap > NAV_JUMP_AFTER_MS) {
      step(to)
      return
    }
    const glide = animate(0, 1, {
      duration: Math.min(gap, NAV_GLIDE_MAX_MS) / 1000,
      ease: 'linear',
      onUpdate: (k) =>
        step({
          at: lerpLngLat(from.at, to.at, k),
          headingDeg: lerpAngle(from.headingDeg, to.headingDeg, k),
          progressM: from.progressM + (to.progressM - from.progressM) * k,
        }),
    })
    return () => glide.stop()
  }, [nav, navRoute, reduce, lockOn])

  // Tell the locate button whether the map already sits on the user (its next press then shows the campus).
  useEffect(() => {
    if (!map) return
    const update = () => {
      const c = map.getCenter()
      publishCentredOnUser(!!me && metresApart(me, [c.lng, c.lat]) < RECENTER_TOGGLE_M)
    }
    update()
    map.on('moveend', update)
    return () => {
      map.off('moveend', update)
      publishCentredOnUser(false)
    }
  }, [map, me])

  // ── Commands from chrome ─────────────────────────────────────────────────
  /** Bearing the user had before the compass turned the map north; the compass turns back to it. */
  const beforeNorth = useRef<number | null>(null)
  useEffect(() => {
    if (!map) return
    return registerMapController({
      recenter: () => {
        const go = (at: LngLat) => map.easeTo({ center: at, zoom: Math.max(map.getZoom(), LOCATE_ZOOM), duration: live.current.reduce ? 0 : CAMERA_MS })
        const here = live.current.me
        if (here) {
          // Already on you: the same button shows the campus instead, and the next press comes back.
          const c = map.getCenter()
          const onMe = metresApart(here, [c.lng, c.lat]) < RECENTER_TOGGLE_M
          return onMe ? map.easeTo({ center: CAMPUS_CENTER, zoom: START_ZOOM, duration: live.current.reduce ? 0 : CAMERA_MS }) : go(here)
        }
        // No position yet: this is the moment to ask (the browser prompt needs a user gesture on iOS).
        void requestLocation().then((fix) => {
          if (live.current.me) return go(live.current.me)
          const { status, reason } = getLocation()
          const why = reason ? ` (Browser said: ${reason})` : ''
          if (fix) notify({ id: 'location', title: 'You are outside the map area', description: 'Odyssey covers USC and about 10 miles around it.' })
          else if (status === 'denied') notify({ id: 'location', title: 'Location is blocked', description: LOCATION_DENIED_HELP + why })
          else notify({ id: 'location', title: 'Could not find your location', description: `Check that location is on for this device, then try again.${why}` })
        })
      },
      zoomBy: (d) => map.zoomTo(map.getZoom() + d, { duration: live.current.reduce ? 0 : 300 }),
      resetNorth: () => {
        const p = cameraPresets[live.current.mapMode]
        const duration = live.current.reduce ? 0 : 500
        if (!p.rotate) {
          map.easeTo({ bearing: p.bearing, pitch: p.pitch, duration })
          return
        }
        // Compass toggle. Rotated: remember where the user was and turn north (tilt untouched).
        // Already north: turn back to the remembered orientation.
        const bearing = map.getBearing()
        if (Math.abs(bearing) >= 0.5) {
          beforeNorth.current = bearing
          map.easeTo({ bearing: 0, duration })
        } else if (beforeNorth.current !== null) {
          map.easeTo({ bearing: beforeNorth.current, duration })
        }
      },
      followTraveller: () => {
        userAim.current = false
        useAppStore.getState().setNavAimFree(false)
        easeToTraveller.current(live.current.reduce ? 0 : CAMERA_MS)
      },
    })
  }, [map])

  // ── Taps on the map itself: demo footprints, then heat cells ─────────────
  useEffect(() => {
    if (!ready || swapping.current) return
    const onClick = (e: MapMouseEvent) => {
      // Choosing a trip end on the map: any tap is the answer, even on a pin or a building.
      const s = useAppStore.getState()
      if (s.picking) return s.setTripEnd(s.picking, pinId([e.lngLat.lng, e.lngLat.lat]))
      // A tap on the traveller: back onto it, heading-up again.
      const t = traveller.current
      if (t && s.activeRouteId) {
        const at = map.project(t.at)
        if (Math.hypot(at.x - e.point.x, at.y - e.point.y) <= TRAVELLER_TAP_PX) return resumeFollow()
      }
      if ((e.originalEvent.target as Element | null)?.closest?.('.maplibregl-marker')) return
      // An emergency phone pole: say what it is (there is no sheet for it yet).
      const phone = map.getLayer('fof-phones-glow') ? map.queryRenderedFeatures([[e.point.x - 12, e.point.y - 12], [e.point.x + 12, e.point.y + 12]], { layers: ['fof-phones-glow'] })[0] : undefined
      if (phone) return notify({ id: 'phone', title: String(phone.properties.name ?? 'Emergency phone'), description: 'Blue light emergency phone. Press its button to reach USC Public Safety. In an emergency, call 911.' })
      // A place name or icon drawn in the map. A finger is not a cursor: accept a near miss.
      const hit = map.queryRenderedFeatures([[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]], { layers: [POI_LAYER] })[0]
      if (hit?.properties.id) return select({ kind: 'place', id: String(hit.properties.id) })
      const place = map.queryRenderedFeatures(e.point, { layers: ['fof-place-fill'] })[0]
      if (place?.properties.id) return select({ kind: 'building', id: String(place.properties.id) })
      const cell = map.queryRenderedFeatures(e.point, { layers: ['fof-heat'] })[0]
      if (cell?.properties.cell) return select({ kind: 'riskCell', id: String(cell.properties.cell) })
      // Blank map: let go of the selected place. Other views (directions, search, layers) are not dismissed by a stray tap.
      if (s.view === 'place' && s.selection) select(null)
    }
    map.on('click', onClick)
    return () => void map.off('click', onClick)
  }, [ready, map, select])

  const pins = useMemo(
    // While navigating, the traveller replaces the "you are here" dot.
    () => [
      ...pinSpecs(me, selectedId, (id) => overrides[id] ?? demoLayerDefaults[id] ?? false).filter((p) => (livePlaces ? p.kind === 'origin' : true) && (!navLive || p.kind !== 'origin')),
      ...placePins(browsing ? (mapPlaces.selected ? [mapPlaces.selected] : []) : mapPlaces.places, selectedId),
      ...tripPins({ from: origin === null ? null : trip.from, to: trip.to, show: planning || navLive }),
    ],
    [me, selectedId, overrides, navLive, origin, trip.from, trip.to, planning, livePlaces, mapPlaces.places, mapPlaces.selected, browsing],
  )

  return (
    <div
      ref={containerRef}
      data-testid="map"
      data-mode={mapMode}
      data-ready={ready || undefined}
      data-picking={picking ?? undefined}
      role="application"
      aria-roledescription="map"
      aria-label={`Campus map, ${mapMode === '2d' ? '2D' : mapMode === 'iso' ? 'isometric' : '3D'} view. Drag to pan, arrow keys to move, plus and minus to zoom.`}
      className="absolute inset-0 z-(--z-map) bg-map-land data-picking:[&_canvas]:cursor-crosshair data-picking:[&_.maplibregl-marker]:pointer-events-none"
      // maplibre-gl.css sets `.maplibregl-map { position: relative }`, which beats utility classes.
      style={{ position: 'absolute', inset: 0 }}
    >
      {map
        ? pins.map((p) => <PinMarker key={p.key} map={map} pin={p} instant={reduce} onSelect={() => p.selection && select(p.selection)} />)
        : null}
    </div>
  )
}

// ── MapLibre plumbing ────────────────────────────────────────────────────────

function setData(map: MlMap, source: string, data: GeoJSON.GeoJSON) {
  ;(map.getSource(source) as GeoJSONSource | undefined)?.setData(data)
}

/** Add our sources and layers under the basemap labels. Idempotent per style. */
function installLayers(map: MlMap, buildings: BuildingSource | null) {
  const layers = map.getStyle().layers
  const beforeLabels = layers.find((l) => l.type === 'symbol')?.id
  // Styles put some symbols (one-way arrows) in the middle of the road layers, so "before the first
  // symbol" is still under bridges and footpaths. Routes go above every line and fill, under the labels that follow.
  const lastShape = layers.findLastIndex((l) => l.type !== 'symbol' && !l.id.startsWith('fof-'))
  const aboveRoads = layers.slice(lastShape + 1).find((l) => !l.id.startsWith('fof-'))?.id
  let anchor = beforeLabels
  const add = (layer: maplibregl.AddLayerObject) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer, anchor)
  }
  for (const id of ['fof-heat', 'fof-places', 'fof-routes', 'fof-nav', 'fof-nav-char', 'fof-floor', POI_SOURCE]) if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY })
  for (const [id, data] of [['fof-phone-poles', EMPTY], ['fof-phones', PHONE_POINTS]] as const) if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data })
  // Emergency phones: a small 3D pole on the ground, and a blue glow at its foot. The glow is a flat layer
  // added on top, so it still shows where a building stands between the pole and the camera.
  if (!map.getLayer('fof-phone-poles'))
    map.addLayer({
      id: 'fof-phone-poles',
      type: 'fill-extrusion',
      source: 'fof-phone-poles',
      minzoom: PHONES_MIN_ZOOM,
      paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-vertical-gradient': false },
    })
  if (!map.getLayer('fof-phones-glow'))
    map.addLayer({
      id: 'fof-phones-glow',
      type: 'circle',
      source: 'fof-phones',
      minzoom: PHONES_MIN_ZOOM,
      paint: {
        'circle-color': PHONE_BLUE,
        // Kept faint and small: there are dozens on campus, and they are a reference, not the subject.
        'circle-radius': ['interpolate', ['linear'], ['zoom'], PHONES_MIN_ZOOM, 2.5, 18, 6],
        'circle-blur': 0.7,
        'circle-opacity': 0.5,
        'circle-pitch-alignment': 'map',
      },
    })
  // Demo mode: simulated crimes. A faint disc for the avoided area, and a pin on top.
  if (!map.getSource(DEMO_INCIDENT_SOURCE)) map.addSource(DEMO_INCIDENT_SOURCE, { type: 'geojson', data: EMPTY })
  if (!map.getLayer('fof-demo-zone'))
    map.addLayer({
      id: 'fof-demo-zone',
      type: 'fill',
      source: DEMO_INCIDENT_SOURCE,
      filter: ['==', ['get', 'kind'], 'zone'],
      paint: { 'fill-color': DEMO_INCIDENT_RED, 'fill-opacity': 0.16 },
    })
  if (!map.getLayer('fof-demo-zone-edge'))
    map.addLayer({
      id: 'fof-demo-zone-edge',
      type: 'line',
      source: DEMO_INCIDENT_SOURCE,
      filter: ['==', ['get', 'kind'], 'zone'],
      paint: { 'line-color': DEMO_INCIDENT_RED, 'line-width': 1.5, 'line-dasharray': [2, 2], 'line-opacity': 0.8 },
    })
  if (!map.getLayer('fof-demo-pin'))
    map.addLayer({
      id: 'fof-demo-pin',
      type: 'circle',
      source: DEMO_INCIDENT_SOURCE,
      filter: ['==', ['get', 'kind'], 'pin'],
      paint: {
        'circle-color': DEMO_INCIDENT_RED,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 5, 18, 10],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-pitch-alignment': 'map',
      },
    })
  const arrow = arrowImage(cssVar('--background'))
  if (map.hasImage(NAV_ARROW)) map.updateImage(NAV_ARROW, arrow)
  else map.addImage(NAV_ARROW, arrow, { pixelRatio: 2 })

  // Place names: on top of everything, sharing collision with the basemap's own labels.
  const labelFont = layers.flatMap((l) => (l.type === 'symbol' && Array.isArray(l.layout?.['text-font']) ? [l.layout['text-font'] as string[]] : []))[0]
  if (!map.getLayer(POI_LAYER))
    map.addLayer({
      id: POI_LAYER,
      type: 'symbol',
      source: POI_SOURCE,
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': 1,
        // Close in, every place keeps at least its icon, even where two sit side by side.
        'icon-allow-overlap': ['step', ['zoom'], false, 17, true],
        'text-field': ['get', 'name'],
        ...(labelFont ? { 'text-font': labelFont } : {}),
        'text-size': 12,
        'text-max-width': 9,
        'text-anchor': 'left',
        'text-offset': [1.2, 0],
        'text-justify': 'left',
        // The icon alone still marks the place when its name does not fit.
        'text-optional': true,
        'symbol-sort-key': ['get', 'rank'],
      },
      paint: { 'text-halo-width': 1.5 },
    })

  // A faint tint on the ground inside each area. Added first, so it lies under the roads, paths and buildings.
  if (!map.getSource('fof-zone-areas')) map.addSource('fof-zone-areas', { type: 'geojson', data: zoneAreas() })
  add({ id: 'fof-zone-fill-dps', type: 'fill', source: 'fof-zone-areas', filter: ['==', ['get', 'zone'], 'dps'], paint: { 'fill-color': cssVar('--map-label'), 'fill-opacity': 0.05 } })
  add({ id: 'fof-zone-fill-campus', type: 'fill', source: 'fof-zone-areas', filter: ['==', ['get', 'zone'], 'campus'], paint: { 'fill-color': cssVar('--brand-ink'), 'fill-opacity': 0.09 } })

  add({ id: 'fof-heat', type: 'fill', source: 'fof-heat', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.32 } })

  if (buildings) {
    if (buildings.add && !map.getSource(buildings.source)) map.addSource(buildings.source, buildings.add)
    // Our footprints and extrusion replace the basemap's own building fill.
    for (const l of layers) if ('source-layer' in l && l['source-layer'] === 'building' && l.type === 'fill') map.setLayoutProperty(l.id, 'visibility', 'none')
    const color = buildingColor()
    // Flat footprints: all of 2D, and Iso / 3D below the extrusion zoom (applyMode sets the range).
    add({
      id: 'fof-buildings-flat',
      type: 'fill',
      source: buildings.source,
      'source-layer': buildings.sourceLayer,
      minzoom: BUILDINGS_TILE_MIN_ZOOM,
      paint: { 'fill-color': color, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], BUILDINGS_MIN_ZOOM, 0, BUILDINGS_FADE_IN_ZOOM, 0.92] },
    })
    // Extrusion grows from 0 at its min zoom, so the hand-over from the flat layer never pops.
    add({
      id: 'fof-buildings',
      type: 'fill-extrusion',
      source: buildings.source,
      'source-layer': buildings.sourceLayer,
      // Same tile range as the flat layer. A layer's zoom range is applied per tile, and a tilted view mixes
      // tile zooms: a narrower range here leaves tiles with neither layer. `syncBuildings` picks the layer instead.
      minzoom: BUILDINGS_TILE_MIN_ZOOM,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': color,
        'fill-extrusion-opacity': 0.92,
        'fill-extrusion-height': growWithZoom(buildings.height),
        'fill-extrusion-base': growWithZoom(buildings.base),
      },
    })
  }

  anchor = aboveRoads
  // Area outlines on the ground: the campus (solid, brand ink) and the DPS patrol area (dashed).
  // Above the roads and buildings' footprints, below the route (whose layers are added after these).
  if (!map.getSource('fof-zones')) map.addSource('fof-zones', { type: 'geojson', data: zoneOutlines() })
  const isZone = (zone: string): ExpressionSpecification => ['==', ['get', 'zone'], zone]
  add({ id: 'fof-zone-dps', type: 'line', source: 'fof-zones', filter: isZone('dps'), layout: { 'line-join': 'round' }, paint: { 'line-width': 2, 'line-dasharray': [3, 2], 'line-opacity': 0.75 } })
  add({ id: 'fof-zone-campus', type: 'line', source: 'fof-zones', filter: isZone('campus'), layout: { 'line-join': 'round' }, paint: { 'line-width': 2.5, 'line-opacity': 0.9 } })

  add({ id: 'fof-place-fill', type: 'fill', source: 'fof-places', paint: { 'fill-color': '#000', 'fill-opacity': 0 } })
  add({ id: 'fof-place-casing', type: 'line', source: 'fof-places', filter: ['==', ['get', 'selected'], true], paint: { 'line-width': 6 } })
  add({ id: 'fof-place-ring', type: 'line', source: 'fof-places', filter: ['==', ['get', 'selected'], true], paint: { 'line-width': 2 } })

  const round = { 'line-join': 'round', 'line-cap': 'round' } as const
  // The destination room's floor (a band round the building) and the hops up to it. Only where buildings are extruded.
  add({
    id: 'fof-floor',
    type: 'fill-extrusion',
    source: 'fof-floor',
    minzoom: BUILDINGS_EXTRUDE_ZOOM,
    paint: { 'fill-extrusion-color': cssVar('--selected'), 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-opacity': 0.9 },
  })
  // Dotted link from the route's end on the street to the place itself (a building's middle, a pin in a field).
  add({ id: 'fof-route-link', type: 'line', source: 'fof-routes', layout: round, filter: ['==', ['get', 'role'], 'link'], paint: { 'line-width': 4, 'line-dasharray': [0.1, 2] } })
  add({ id: 'fof-route-alt', type: 'line', source: 'fof-routes', layout: round, filter: ['==', ['get', 'role'], 'alt'], paint: { 'line-width': 5, 'line-opacity': 0.55 } })
  // Travelled part while navigating: same casing, dimmed muted line.
  const done = ['==', ['get', 'role'], 'done'] as ExpressionSpecification
  add({ id: 'fof-route-done-casing', type: 'line', source: 'fof-routes', layout: round, filter: done, paint: { 'line-width': 10, 'line-opacity': 0.7 } })
  add({ id: 'fof-route-done', type: 'line', source: 'fof-routes', layout: round, filter: done, paint: { 'line-width': 5, 'line-opacity': 0.45 } })
  add({ id: 'fof-route-casing', type: 'line', source: 'fof-routes', layout: round, filter: ['==', ['get', 'role'], 'casing'], paint: { 'line-width': 12 } })
  add({
    id: 'fof-route',
    type: 'line',
    source: 'fof-routes',
    layout: round,
    filter: ['==', ['get', 'role'], 'segment'],
    paint: { 'line-width': 7, 'line-color': ['get', 'color'] },
  })

  // Direction arrows along the remaining line. Labels stay above the line; these sit just under them.
  add({
    id: 'fof-nav-arrows',
    type: 'symbol',
    source: 'fof-nav',
    filter: ['==', ['get', 'role'], 'ahead'],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 56,
      'icon-image': NAV_ARROW,
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
      'icon-keep-upright': false,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': 0.9 },
  })

  // Above the labels: maneuver dots, destination, traveller.
  const top = (layer: maplibregl.AddLayerObject) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer)
  }
  const flatMap = { 'circle-pitch-alignment': 'map', 'circle-pitch-scale': 'viewport' } as const
  top({
    id: 'fof-nav-step',
    type: 'circle',
    source: 'fof-nav',
    filter: ['==', ['get', 'role'], 'step'],
    paint: { 'circle-radius': 4.5, 'circle-stroke-width': 2.5, ...flatMap },
  })
  const dest = ['==', ['get', 'role'], 'destination'] as ExpressionSpecification
  top({ id: 'fof-nav-dest', type: 'circle', source: 'fof-nav', filter: dest, paint: { 'circle-radius': 10, 'circle-stroke-width': 3, ...flatMap } })
  top({ id: 'fof-nav-dest-dot', type: 'circle', source: 'fof-nav', filter: dest, paint: { 'circle-radius': 3.5, ...flatMap } })

  // Traveller: halo, then flat in 2D (with a casing), extruded and lit in Iso and 3D.
  top({
    id: 'fof-nav-halo',
    type: 'circle',
    source: 'fof-nav-char',
    filter: ['==', ['get', 'role'], 'halo'],
    paint: {
      'circle-radius': 22,
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.16,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': ['get', 'color'],
      'circle-stroke-opacity': 0.5,
      ...flatMap,
    },
  })
  const flat = ['==', ['get', 'solid'], false] as ExpressionSpecification
  top({
    id: 'fof-nav-char-casing',
    type: 'line',
    source: 'fof-nav-char',
    filter: ['all', flat, ['==', ['get', 'outline'], true]],
    layout: { 'line-join': 'round' },
    paint: { 'line-width': 3 },
  })
  top({ id: 'fof-nav-char-flat', type: 'fill', source: 'fof-nav-char', filter: flat, paint: { 'fill-color': ['get', 'color'] } })
  top({
    id: 'fof-nav-char-solid',
    type: 'fill-extrusion',
    source: 'fof-nav-char',
    filter: ['==', ['get', 'solid'], true],
    paint: {
      'fill-extrusion-color': ['get', 'color'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['get', 'base'],
      'fill-extrusion-opacity': 1,
      'fill-extrusion-vertical-gradient': true,
    },
  })
}

const NAV_ARROW = 'fof-nav-arrow'

/** A small chevron pointing along +x (the line direction), drawn at 2x. */
function arrowImage(color: string): ImageData {
  const s = 2
  const c = document.createElement('canvas')
  c.width = 12 * s
  c.height = 12 * s
  const g = c.getContext('2d')!
  g.strokeStyle = color
  g.lineWidth = 2.25 * s
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(4 * s, 3 * s)
  g.lineTo(8 * s, 6 * s)
  g.lineTo(4 * s, 9 * s)
  g.stroke()
  return g.getImageData(0, 0, c.width, c.height)
}

/** Camera preset, interaction handlers, and building height (flat in 2D, extruded in Iso and 3D). */
function applyMode(map: MlMap, mode: keyof typeof cameraPresets, duration: number, keepPose = false) {
  const p = cameraPresets[mode]
  const rotate = p.rotate
  if (rotate) {
    map.dragRotate.enable()
    map.touchZoomRotate.enableRotation()
    map.keyboard.enableRotation()
  } else {
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
  }
  // `keepPose`: same mode as before (style reload, re-render). Free-rotate modes keep the user's orientation.
  if (!(keepPose && rotate)) map.easeTo({ pitch: p.pitch, bearing: rotate ? map.getBearing() || p.bearing : p.bearing, duration })
  syncBuildings(map, mode)
}

/**
 * Exactly one building layer shows, chosen by the camera zoom for the whole view: flat footprints in 2D
 * and below the extrusion zoom, extrusion above it (starting at height 0, so the switch does not pop).
 */
function syncBuildings(map: MlMap, mode: keyof typeof cameraPresets) {
  if (!map.getLayer('fof-buildings')) return
  const extrude = mode !== '2d' && map.getZoom() >= BUILDINGS_EXTRUDE_ZOOM
  const want = { 'fof-buildings': extrude, 'fof-buildings-flat': !extrude }
  for (const [id, on] of Object.entries(want)) {
    const visibility = on ? 'visible' : 'none'
    if (map.getLayoutProperty(id, 'visibility') !== visibility) map.setLayoutProperty(id, 'visibility', visibility)
  }
}

// ── Pins ─────────────────────────────────────────────────────────────────────

/** An HTML marker whose content React renders through a portal. Constant size at any zoom, upright at any pitch. */
function PinMarker({ map, pin, instant, onSelect }: { map: MlMap; pin: PinSpec; instant: boolean; onSelect: () => void }) {
  const [el] = useState(() => document.createElement('div'))
  const marker = useRef<maplibregl.Marker | null>(null)
  const [lng, lat] = pin.lngLat
  useEffect(() => {
    const m = new maplibregl.Marker({ element: el, anchor: pin.kind === 'origin' ? 'center' : 'bottom' }).setLngLat([lng, lat]).addTo(map)
    marker.current = m
    return () => void m.remove()
  }, [el, map, lng, lat, pin.kind])
  const z = pin.selected ? '2' : pin.kind === 'building' ? '0' : '1'
  useEffect(() => {
    const node = marker.current?.getElement()
    if (node) node.style.zIndex = z
  }, [z])
  return createPortal(<PinBody pin={pin} instant={instant} onSelect={onSelect} />, el)
}

/** A drag that starts on a pin pans the map; only a press that stays put selects. */
function useTap(onTap: () => void) {
  const down = useRef<{ x: number; y: number } | null>(null)
  return {
    onPointerDown: (e: ReactPointerEvent) => {
      down.current = { x: e.clientX, y: e.clientY }
    },
    onClick: (e: ReactMouseEvent) => {
      const d = down.current
      down.current = null
      // Keyboard activation has no pointerdown (detail 0); a mouse or touch tap must not have moved.
      if (e.detail !== 0 && d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return
      onTap()
    },
  }
}

/** The keystone settling onto a newly selected pin (DESIGN.md §4, `ease-emphasis`). */
function SettlingKeystone({ instant }: { instant: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      initial={{ opacity: 0, y: instant ? 0 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: instant ? 0.2 : 0.3, ease: EASE_EMPHASIS }}
    >
      {/* Background casing keeps it visible on the gold night fill. */}
      <Keystone className="-top-0.5 -right-0.5 ring-1 ring-background" />
    </motion.span>
  )
}

function PinBody({ pin, instant, onSelect }: { pin: PinSpec; instant: boolean; onSelect: () => void }) {
  const tap = useTap(onSelect)
  const growT = { duration: instant ? 0 : 0.3, ease: EASE_SETTLE }

  if (pin.kind === 'origin') {
    return (
      <div className="pointer-events-none" aria-label="Your location" role="img">
        {/* Cardinal by day with the keystone; gold at night (cardinal on dark is about 2:1). */}
        <span className="relative block size-5 rounded-full border-4 border-background bg-brand shadow-chip dark:bg-gold">
          <Keystone className="-top-1 -right-1 dark:hidden" />
        </span>
      </div>
    )
  }
  if (pin.kind === 'building') {
    return (
      <button
        type="button"
        data-pin={pin.key}
        aria-pressed={pin.selected}
        {...tap}
        className="flex min-h-tap min-w-tap cursor-pointer flex-col items-center justify-end outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-ring"
      >
        <span
          className={
            pin.selected
              ? 'caption-3 relative rounded-full bg-selected px-3 py-1 whitespace-nowrap text-selected-foreground shadow-chip'
              : 'caption-4 rounded-full px-2 py-0.5 whitespace-nowrap text-map-label [text-shadow:0_0_2px_var(--map-label-halo),0_0_2px_var(--map-label-halo),0_0_4px_var(--map-label-halo)]'
          }
        >
          {pin.label}
          {pin.selected ? <SettlingKeystone instant={instant} /> : null}
        </span>
        <span aria-hidden className={pin.selected ? 'h-2 w-0.5 bg-selected' : 'h-1 w-px bg-map-building-edge'} />
      </button>
    )
  }
  if (pin.kind === 'trip') {
    return (
      <div className="pointer-events-none grid place-items-end justify-center" aria-label={pin.label} role="img" data-pin={pin.key}>
        {pin.type === 'trip-start' ? (
          <span className="block size-4 rounded-full border-[3px] border-foreground bg-background shadow-chip" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-selected text-selected-foreground shadow-chip [&_svg]:size-4">
            <PlaceIcon type="pin" weight="fill" />
          </span>
        )}
      </div>
    )
  }
  const emergency = pin.type === 'blue_light' || pin.type === 'dps'
  return (
    <button
      type="button"
      data-pin={pin.key}
      aria-label={pin.label}
      aria-pressed={pin.selected}
      {...tap}
      className="grid size-tap cursor-pointer place-items-end justify-center outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-ring"
    >
      <motion.span
        className={
          'relative grid size-8 origin-bottom place-items-center rounded-full shadow-chip [&_svg]:size-4 ' +
          (pin.selected ? 'bg-selected text-selected-foreground' : emergency ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground')
        }
        initial={false}
        animate={{ scale: pin.selected ? 1.25 : 1 }}
        transition={growT}
      >
        <PlaceIcon type={pin.type} weight={pin.selected ? 'fill' : 'regular'} />
        {pin.selected ? <SettlingKeystone instant={instant} /> : null}
      </motion.span>
    </button>
  )
}

