import 'maplibre-gl/dist/maplibre-gl.css'
import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, GeoJSONSource, Map as MlMap, MapMouseEvent } from 'maplibre-gl'
// MapLibre 6 spawns a module worker next to its own file, which Vite's dep prebundling does not copy.
// Bundle the worker ourselves and point MapLibre at it.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { motion, useReducedMotion } from 'motion/react'
import { Protocol } from 'pmtiles'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useAppConfig } from '@/api/queries'
// DEMO: sample places, routes and heat at real coordinates. Replace with adapters when the backend serves them.
import { CAMPUS_CENTER, ORIGIN, buildings, demoLayerDefaults, demoRoutes, SAFETY_HEAT_LAYER } from '@/demo'
import { demoRiskCells } from '@/demo/heat'
import type { AppConfig } from '@/domain'
import { env } from '@/lib/env'
import { useAppStore } from '@/state/store'
import { Keystone, PlaceIcon, useBreakpoint, useTheme, useViewportHeight } from '@/ui'
import { DEV_FALLBACK_STYLE, buildMapStyle, type MapTheme } from './basemap'
import { backendBuildingsAvailable, backendBuildingsUrl, basemapBuildings, pmtilesBuildings, type BuildingSource } from './buildings'
import { LOCATE_ZOOM, MAX_PITCH, MAX_ZOOM, MIN_ZOOM, START_ZOOM, bboxOf, boundsAround, cameraPresets } from './camera'
import { publishBearing, registerMapController } from './controller'
import { chromeInsets } from './insets'
import { fitPoints, heatFeatures, pinSpecs, placeFeatures, routeFeatures, shownRoutes, type PinSpec, type RiskPalette } from './overlays'

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
const riskPalette = (): RiskPalette => [1, 2, 3, 4, 5].map((i) => cssVar(`--risk-${i}`)) as unknown as RiskPalette

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
  const view = useAppStore((s) => s.view)
  const destination = useAppStore((s) => s.destination)
  const travelMode = useAppStore((s) => s.travelMode)
  const routeKind = useAppStore((s) => s.routeKind)
  const activeRouteId = useAppStore((s) => s.activeRouteId)
  const breakpoint = useBreakpoint()
  const viewportH = useViewportHeight()
  const viewportW = useViewportWidth()
  const theme: MapTheme = useTheme().resolved
  const reduce = useReducedMotion() ?? false

  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MlMap | null>(null)
  /** Bumps on every style load: custom sources and layers must be re-added after `setStyle`. */
  const [styleGen, setStyleGen] = useState(0)
  const [buildingSrc, setBuildingSrc] = useState<'pending' | 'basemap' | string>('pending')

  const live = useRef({ mapMode, reduce })
  useEffect(() => {
    live.current = { mapMode, reduce }
  }, [mapMode, reduce])

  const on = (id: string) => overrides[id] ?? demoLayerDefaults[id] ?? false
  const heatOn = on(SAFETY_HEAT_LAYER)
  const selectedId = selection?.id ?? null
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
      fadeDuration: live.current.reduce ? 0 : 300,
    })
    m.on('style.load', () => setStyleGen((g) => g + 1))
    m.on('rotate', () => publishBearing(m.getBearing()))
    setMap(m)

    const url = backendBuildingsUrl()
    if (url) void backendBuildingsAvailable(url).then((ok) => setBuildingSrc(ok ? url : 'basemap'))
    else setBuildingSrc('basemap')

    return () => {
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
    map.setStyle(buildMapStyle(config.basemap, theme, !env.mapStyleUrl), { diff: false })
  }, [map, styleKey, config.basemap, theme])

  // ── Overlays: (re)install after each style load ────────────────────────────
  useEffect(() => {
    if (!map || !styleGen || buildingSrc === 'pending') return
    installLayers(map, buildingSrc === 'basemap' ? basemapBuildings(map.getStyle()) : pmtilesBuildings(buildingSrc))
    applyMode(map, live.current.mapMode, 0)
  }, [map, styleGen, buildingSrc])

  const routes = useMemo(
    () => shownRoutes(demoRoutes(destination, travelMode), { activeRouteId, directions: view === 'directions', routeKind }),
    [destination, travelMode, activeRouteId, view, routeKind],
  )
  const ready = !!map && styleGen > 0 && buildingSrc !== 'pending'

  useEffect(() => {
    if (!ready) return
    setData(map, 'fof-routes', routeFeatures(routes, riskPalette()))
    map.setPaintProperty('fof-route-casing', 'line-color', cssVar('--background'))
    map.setPaintProperty('fof-route-alt', 'line-color', cssVar('--muted-foreground'))
  }, [ready, map, styleGen, routes, theme])

  const heat = useMemo(() => demoRiskCells(), [])
  useEffect(() => {
    if (!ready) return
    setData(map, 'fof-heat', heatOn ? heatFeatures(heat, riskPalette()) : EMPTY)
  }, [ready, map, styleGen, heatOn, heat, theme])

  useEffect(() => {
    if (!ready) return
    setData(map, 'fof-places', placeFeatures(selectedId))
    map.setPaintProperty('fof-place-casing', 'line-color', cssVar('--background'))
    map.setPaintProperty('fof-place-ring', 'line-color', cssVar('--selected'))
    if (map.getLayer('fof-buildings')) map.setPaintProperty('fof-buildings', 'fill-extrusion-color', cssVar('--map-building'))
  }, [ready, map, styleGen, selectedId, theme])

  // ── Camera mode ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (ready) applyMode(map, mapMode, ms)
  }, [ready, map, mapMode, ms])

  // ── Padding and fit ──────────────────────────────────────────────────────
  const routeActive = activeRouteId !== null
  const insets = useMemo(
    () => chromeInsets({ breakpoint, sheetSnap, panelOpen, routeActive, viewportW, viewportH }),
    [breakpoint, sheetSnap, panelOpen, routeActive, viewportW, viewportH],
  )
  const fit = useMemo(() => fitPoints(routes, selection), [routes, selection])
  const framed = useRef(false)
  useEffect(() => {
    if (!map) return
    const w = map.getContainer().clientWidth
    const h = map.getContainer().clientHeight
    // Sheet at full: nothing left to frame into. Leave the camera alone.
    if (w - insets.left - insets.right < 80 || h - insets.top - insets.bottom < 80) return
    // First view with nothing selected: the whole demo campus and "you are here".
    const target = fit ?? (framed.current ? null : { kind: 'campus' as const, points: [ORIGIN, ...CAMPUS_POINTS] })
    framed.current = true
    const box = target && bboxOf(target.points)
    const preset = cameraPresets[mapMode]
    // Ease to the mode's pitch and bearing too, so a mode change in the same render is not cancelled.
    const pose = { pitch: preset.pitch, bearing: preset.rotate ? map.getBearing() || preset.bearing : preset.bearing }
    if (!box || !target) {
      map.easeTo({ padding: insets, ...pose, duration: ms })
      return
    }
    const m = target.kind === 'route' ? { x: 32, y: 40 } : target.kind === 'campus' ? { x: 16, y: 16 } : { x: 104, y: 56 } // room for labels and pins
    const padding = { top: insets.top + m.y + 44, bottom: insets.bottom + m.y, left: insets.left + m.x, right: insets.right + m.x }
    const cam = map.cameraForBounds(box, {
      padding,
      absolutePadding: true,
      bearing: pose.bearing,
      maxZoom: target.kind === 'place' ? Math.max(map.getZoom(), 17) : 18,
    })
    if (!cam) return
    // The fit already accounts for padding; keep only the chrome insets as the map's padding.
    map.easeTo({ ...cam, padding: insets, pitch: pose.pitch, duration: target.kind === 'campus' ? 0 : ms })
  }, [map, fit, insets, ms, mapMode])

  // ── Commands from chrome ─────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return
    return registerMapController({
      recenter: () => map.easeTo({ center: ORIGIN, zoom: Math.max(map.getZoom(), LOCATE_ZOOM), duration: live.current.reduce ? 0 : CAMERA_MS }),
      zoomBy: (d) => map.zoomTo(map.getZoom() + d, { duration: live.current.reduce ? 0 : 300 }),
      resetNorth: () => {
        const p = cameraPresets[live.current.mapMode]
        map.easeTo({ bearing: p.rotate ? 0 : p.bearing, pitch: p.pitch, duration: live.current.reduce ? 0 : 500 })
      },
    })
  }, [map])

  // ── Taps on the map itself: demo footprints, then heat cells ─────────────
  useEffect(() => {
    if (!ready) return
    const onClick = (e: MapMouseEvent) => {
      if ((e.originalEvent.target as Element | null)?.closest?.('.maplibregl-marker')) return
      const place = map.queryRenderedFeatures(e.point, { layers: ['fof-place-fill'] })[0]
      if (place?.properties.id) return select({ kind: 'building', id: String(place.properties.id) })
      const cell = map.queryRenderedFeatures(e.point, { layers: ['fof-heat'] })[0]
      if (cell?.properties.cell) select({ kind: 'riskCell', id: String(cell.properties.cell) })
    }
    map.on('click', onClick)
    return () => void map.off('click', onClick)
  }, [ready, map, select])

  const pins = useMemo(
    () => pinSpecs(ORIGIN, selectedId, (id) => overrides[id] ?? demoLayerDefaults[id] ?? false),
    [selectedId, overrides],
  )

  return (
    <div
      ref={containerRef}
      data-testid="map"
      data-mode={mapMode}
      data-ready={ready || undefined}
      role="application"
      aria-roledescription="map"
      aria-label={`Campus map, ${mapMode === '2d' ? '2D' : mapMode === 'iso' ? 'isometric' : '3D'} view. Drag to pan, arrow keys to move, plus and minus to zoom.`}
      className="absolute inset-0 z-(--z-map) bg-map-land"
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
  const add = (layer: maplibregl.AddLayerObject) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer, beforeLabels)
  }
  for (const id of ['fof-heat', 'fof-places', 'fof-routes']) if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY })

  add({ id: 'fof-heat', type: 'fill', source: 'fof-heat', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.32 } })

  if (buildings) {
    if (buildings.add && !map.getSource(buildings.source)) map.addSource(buildings.source, buildings.add)
    // Our extrusion replaces the basemap's flat building fill.
    for (const l of layers) if ('source-layer' in l && l['source-layer'] === 'building' && l.type === 'fill') map.setLayoutProperty(l.id, 'visibility', 'none')
    add({
      id: 'fof-buildings',
      type: 'fill-extrusion',
      source: buildings.source,
      'source-layer': buildings.sourceLayer,
      minzoom: 13,
      metadata: { height: buildings.height, base: buildings.base },
      paint: { 'fill-extrusion-color': cssVar('--map-building'), 'fill-extrusion-opacity': 0.92, 'fill-extrusion-height': 0, 'fill-extrusion-base': 0 },
    })
  }

  add({ id: 'fof-place-fill', type: 'fill', source: 'fof-places', paint: { 'fill-color': '#000', 'fill-opacity': 0 } })
  add({ id: 'fof-place-casing', type: 'line', source: 'fof-places', filter: ['==', ['get', 'selected'], true], paint: { 'line-width': 6 } })
  add({ id: 'fof-place-ring', type: 'line', source: 'fof-places', filter: ['==', ['get', 'selected'], true], paint: { 'line-width': 2 } })

  const round = { 'line-join': 'round', 'line-cap': 'round' } as const
  add({ id: 'fof-route-alt', type: 'line', source: 'fof-routes', layout: round, filter: ['==', ['get', 'role'], 'alt'], paint: { 'line-width': 5, 'line-opacity': 0.55 } })
  add({ id: 'fof-route-casing', type: 'line', source: 'fof-routes', layout: round, filter: ['==', ['get', 'role'], 'casing'], paint: { 'line-width': 12 } })
  add({
    id: 'fof-route',
    type: 'line',
    source: 'fof-routes',
    layout: round,
    filter: ['==', ['get', 'role'], 'segment'],
    paint: { 'line-width': 7, 'line-color': ['get', 'color'] },
  })
}

/** Camera preset, interaction handlers, and building height (flat in 2D, extruded in Iso and 3D). */
function applyMode(map: MlMap, mode: keyof typeof cameraPresets, duration: number) {
  const p = cameraPresets[mode]
  const rotate = p.rotate
  if (rotate) {
    map.dragRotate.enable()
    map.touchZoomRotate.enableRotation()
    map.touchPitch.enable()
    map.keyboard.enableRotation()
  } else {
    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()
    map.touchPitch.disable()
    map.keyboard.disableRotation()
  }
  map.easeTo({ pitch: p.pitch, bearing: rotate ? map.getBearing() || p.bearing : p.bearing, duration })
  const layer = map.getLayer('fof-buildings')
  if (!layer) return
  const meta = layer.metadata as { height: ExpressionSpecification; base: ExpressionSpecification }
  const flat = mode === '2d'
  map.setPaintProperty('fof-buildings', 'fill-extrusion-height', flat ? 0 : meta.height)
  map.setPaintProperty('fof-buildings', 'fill-extrusion-base', flat ? 0 : meta.base)
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

