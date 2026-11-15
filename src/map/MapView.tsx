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
import { useAppConfig } from '@/api/queries'
// DEMO: sample places, routes and heat at real coordinates. Replace with adapters when the backend serves them.
import { CAMPUS_CENTER, ORIGIN, buildings, demoLayerDefaults, demoRoutes, SAFETY_HEAT_LAYER } from '@/demo'
import { demoRiskCells } from '@/demo/heat'
import type { AppConfig, LngLat, MapMode } from '@/domain'
import { env } from '@/lib/env'
import { useAppStore } from '@/state/store'
import { Keystone, PlaceIcon, useBreakpoint, useTheme, useViewportHeight } from '@/ui'
import { DEV_FALLBACK_STYLE, buildMapStyle, type MapTheme } from './basemap'
import { backendBuildingsAvailable, backendBuildingsUrl, basemapBuildings, growWithZoom, pmtilesBuildings, type BuildingSource } from './buildings'
import {
  BUILDINGS_EXTRUDE_ZOOM,
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
import { publishBearing, registerMapController } from './controller'
import { chromeInsets } from './insets'
import { installTouchTilt } from './touchTilt'
import { fitPoints, heatFeatures, navFeatures, pinSpecs, placeFeatures, routeFeatures, shownRoutes, type PinSpec, type RiskPalette } from './overlays'

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
/** Same rule as the "you are here" dot: cardinal by day, gold at night. */
const characterColors = (theme: MapTheme): CharacterColors =>
  theme === 'dark' ? { body: cssVar('--gold'), accent: cssVar('--brand') } : { body: cssVar('--brand'), accent: cssVar('--gold') }

/** Follow camera: north-up in 2D and Iso (their fixed bearing), heading-up in 3D. */
const followBearing = (mode: MapMode, headingDeg: number) => (mode === '3d' ? headingDeg : cameraPresets[mode].bearing)

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
  const view = useAppStore((s) => s.view)
  const destination = useAppStore((s) => s.destination)
  const travelMode = useAppStore((s) => s.travelMode)
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
      // Two-finger tilt is ours (touchTilt.ts): MapLibre's gives up on real, imperfect fingers.
      touchPitch: false,
      fadeDuration: live.current.reduce ? 0 : 300,
    })
    m.on('style.load', () => {
      swapping.current = false
      setStyleGen((g) => g + 1)
    })
    m.on('rotate', () => publishBearing(m.getBearing()))
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
    applyMode(map, live.current.mapMode, 0)
  }, [map, styleGen, buildingSrc])

  const routes = useMemo(
    () => shownRoutes(demoRoutes(destination, travelMode), { activeRouteId, directions: view === 'directions', routeKind }),
    [destination, travelMode, activeRouteId, view, routeKind],
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
      setData(map, 'fof-routes', routeFeatures(routes, riskPalette(), progress))
      setData(map, 'fof-nav', navRoute ? navFeatures(navRoute, progress ?? 0) : EMPTY)
      if (!navRoute || !t) {
        setData(map, 'fof-nav-char', EMPTY)
        return
      }
      const colors = characterColors(theme)
      const body = characterFeatures(characterFor(navCharacter), t, { zoom: map.getZoom(), mode: mapMode }, colors)
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

  const heat = useMemo(() => demoRiskCells(), [])
  useEffect(() => {
    if (!ready || swapping.current) return
    setData(map, 'fof-heat', heatOn ? heatFeatures(heat, riskPalette()) : EMPTY)
  }, [ready, map, styleGen, heatOn, heat, theme])

  useEffect(() => {
    if (!ready || swapping.current) return
    setData(map, 'fof-places', placeFeatures(selectedId))
    map.setPaintProperty('fof-place-casing', 'line-color', cssVar('--background'))
    map.setPaintProperty('fof-place-ring', 'line-color', cssVar('--selected'))
    if (map.getLayer('fof-buildings')) {
      map.setPaintProperty('fof-buildings', 'fill-extrusion-color', cssVar('--map-building'))
      map.setPaintProperty('fof-buildings-flat', 'fill-color', cssVar('--map-building'))
    }
  }, [ready, map, styleGen, selectedId, theme])

  // ── Camera mode ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (ready && !swapping.current) applyMode(map, mapMode, ms)
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
    if (!map || navLive) return
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
  }, [map, fit, insets, ms, mapMode, navLive])

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
      if (e.originalEvent && navOn()) userAim.current = true
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
      followTraveller: () => {
        userAim.current = false
        easeToTraveller.current(live.current.reduce ? 0 : CAMERA_MS)
      },
    })
  }, [map])

  // ── Taps on the map itself: demo footprints, then heat cells ─────────────
  useEffect(() => {
    if (!ready || swapping.current) return
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
    // While navigating, the traveller replaces the "you are here" dot.
    () => pinSpecs(ORIGIN, selectedId, (id) => overrides[id] ?? demoLayerDefaults[id] ?? false).filter((p) => !navLive || p.kind !== 'origin'),
    [selectedId, overrides, navLive],
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
  for (const id of ['fof-heat', 'fof-places', 'fof-routes', 'fof-nav', 'fof-nav-char']) if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY })
  const arrow = arrowImage(cssVar('--background'))
  if (map.hasImage(NAV_ARROW)) map.updateImage(NAV_ARROW, arrow)
  else map.addImage(NAV_ARROW, arrow, { pixelRatio: 2 })

  add({ id: 'fof-heat', type: 'fill', source: 'fof-heat', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.32 } })

  if (buildings) {
    if (buildings.add && !map.getSource(buildings.source)) map.addSource(buildings.source, buildings.add)
    // Our footprints and extrusion replace the basemap's own building fill.
    for (const l of layers) if ('source-layer' in l && l['source-layer'] === 'building' && l.type === 'fill') map.setLayoutProperty(l.id, 'visibility', 'none')
    const color = cssVar('--map-building')
    // Flat footprints: all of 2D, and Iso / 3D below the extrusion zoom (applyMode sets the range).
    add({
      id: 'fof-buildings-flat',
      type: 'fill',
      source: buildings.source,
      'source-layer': buildings.sourceLayer,
      minzoom: BUILDINGS_MIN_ZOOM,
      paint: { 'fill-color': color, 'fill-opacity': 0.92 },
    })
    // Extrusion grows from 0 at its min zoom, so the hand-over from the flat layer never pops.
    add({
      id: 'fof-buildings',
      type: 'fill-extrusion',
      source: buildings.source,
      'source-layer': buildings.sourceLayer,
      minzoom: BUILDINGS_EXTRUDE_ZOOM,
      layout: { visibility: 'none' },
      paint: {
        'fill-extrusion-color': color,
        'fill-extrusion-opacity': 0.92,
        'fill-extrusion-height': growWithZoom(buildings.height),
        'fill-extrusion-base': growWithZoom(buildings.base),
      },
    })
  }

  add({ id: 'fof-place-fill', type: 'fill', source: 'fof-places', paint: { 'fill-color': '#000', 'fill-opacity': 0 } })
  add({ id: 'fof-place-casing', type: 'line', source: 'fof-places', filter: ['==', ['get', 'selected'], true], paint: { 'line-width': 6 } })
  add({ id: 'fof-place-ring', type: 'line', source: 'fof-places', filter: ['==', ['get', 'selected'], true], paint: { 'line-width': 2 } })

  const round = { 'line-join': 'round', 'line-cap': 'round' } as const
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
function applyMode(map: MlMap, mode: keyof typeof cameraPresets, duration: number) {
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
  map.easeTo({ pitch: p.pitch, bearing: rotate ? map.getBearing() || p.bearing : p.bearing, duration })
  if (!map.getLayer('fof-buildings')) return
  // 2D: footprints only, no extrusion layer at all. Iso / 3D: footprints until the extrusion zoom.
  const flat = mode === '2d'
  map.setLayoutProperty('fof-buildings', 'visibility', flat ? 'none' : 'visible')
  map.setLayerZoomRange('fof-buildings-flat', BUILDINGS_MIN_ZOOM, flat ? 24 : BUILDINGS_EXTRUDE_ZOOM)
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

