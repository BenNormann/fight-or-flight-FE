import { CalendarDots } from '@phosphor-icons/react'
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
} from 'motion/react'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from 'react'
// DEMO: placeholder geometry and places. Delete with src/demo when MapLibre lands.
import {
  CAMPUS_RECT,
  ORIGIN,
  PLANE,
  buildings as demoBuildings,
  demoLayerDefaults,
  demoRiskBlobs,
  demoRoutes,
  events as demoEvents,
  pois as demoPois,
  project,
} from '@/demo'
import type { Building, Id, MapMode, Poi } from '@/domain'
import { riskColor } from '@/lib/risk'
import { useAppStore } from '@/state/store'
import { SIDE_PANEL_PX, useBreakpoint } from '@/ui'
import { registerMapController } from './controller'
import { PinIcon } from './pinIcons'
import { clampView, isDoubleTap, isDrag, pan, pinch, wheelFactor, zoomAt, type Tilt, type View } from './viewport'

/**
 * The ONLY map instance in the app.
 *
 * Placeholder until the map lane mounts MapLibre + deck.gl here: a themed,
 * procedurally drawn city around a demo campus. Drag to pan, wheel / pinch /
 * double tap to zoom, arrows and +/- when focused. Campus buildings and pins
 * are tappable and set the selection; a drag never counts as a tap. `mapMode`
 * tilts the plane with CSS 3D; iso and 3D stack roof slices to fake extrusion.
 * No tiles, no network.
 */

const SIZE = PLANE
const LEVELS = 6
const LEVEL_PX = 7
const EASE_SETTLE = [0.22, 1, 0.36, 1] as const
const EASE_EMPHASIS = [0.34, 1.3, 0.64, 1] as const
const CAMERA_S = 0.8
const KEY_PAN_PX = 96
const HOME: View = { cx: CAMPUS_RECT.x + CAMPUS_RECT.w / 2, cy: CAMPUS_RECT.y + CAMPUS_RECT.h / 2, zoom: 1 }
const [ORIGIN_X, ORIGIN_Y] = project(ORIGIN)
const LOCATE: View = { cx: ORIGIN_X, cy: ORIGIN_Y, zoom: 1.5 }

interface Rect {
  x: number
  y: number
  w: number
  h: number
}
interface Block extends Rect {
  level: number
  id?: Id
}

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

function lines(rand: () => number) {
  const out: { at: number; width: number }[] = []
  let at = 40
  let i = 0
  while (at < SIZE) {
    const width = i % 3 === 0 ? 22 : 10
    out.push({ at, width })
    at += width + 110 + Math.round(rand() * 70)
    i++
  }
  return out
}

function buildCity() {
  const rand = mulberry32(20261114)
  const cols = lines(rand)
  const rows = lines(rand)
  const streets = [
    ...cols.map((c, i) => ({ x: c.at, y: 0, w: c.width, h: SIZE, major: i % 3 === 0 })),
    ...rows.map((r, i) => ({ x: 0, y: r.at, w: SIZE, h: r.width, major: i % 3 === 0 })),
  ]
  const blocks: Rect[] = []
  const parks: Rect[] = []
  const buildings: Block[] = []
  const pairs = <T,>(xs: T[]) => xs.slice(1).map((next, i) => [xs[i]!, next] as const)

  for (const [c0, c1] of pairs(cols)) {
    for (const [r0, r1] of pairs(rows)) {
      const x = c0.at + c0.width
      const y = r0.at + r0.width
      const block = { x, y, w: c1.at - x, h: r1.at - y }
      if (overlaps(block, CAMPUS_RECT)) continue
      blocks.push(block)
      if (rand() < 0.09) {
        parks.push(block)
        continue
      }
      const nx = block.w > 150 ? 3 : 2
      const ny = rand() < 0.5 ? 1 : 2
      const lw = (block.w - 16 - 6 * (nx - 1)) / nx
      const lh = (block.h - 16 - 6 * (ny - 1)) / ny
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          if (rand() < 0.18) continue
          const shrink = rand() < 0.3 ? 0.7 : 1
          const r = rand()
          buildings.push({
            x: block.x + 8 + i * (lw + 6),
            y: block.y + 8 + j * (lh + 6),
            w: lw * shrink,
            h: lh * (shrink === 1 ? 1 : 0.85),
            level: r < 0.4 ? 1 : r < 0.7 ? 2 : r < 0.87 ? 3 : r < 0.96 ? 4 : 5,
          })
        }
      }
    }
  }
  return { streets, blocks, parks, buildings }
}

const CITY = buildCity()

function footprintRect(b: Building): Rect {
  const ring = b.footprint.type === 'Polygon' ? b.footprint.coordinates[0] : b.footprint.coordinates[0]?.[0]
  const pts = (ring ?? []).map((p) => project([p[0]!, p[1]!]))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

const CAMPUS: Block[] = demoBuildings.map((b) => ({ ...footprintRect(b), level: Math.min(LEVELS, b.floors ?? 2), id: b.id }))
const ALL_BLOCKS: Block[] = [...CITY.buildings, ...CAMPUS]

const CAMERA: Record<MapMode, Tilt> = {
  '2d': { rotateX: 0, rotateZ: 0, scale: 1 },
  iso: { rotateX: 52, rotateZ: -38, scale: 1.05 },
  '3d': { rotateX: 62, rotateZ: -16, scale: 1.4 },
}

/** Extrusion walls: a shade between building fill and edge. */
const WALL = 'color-mix(in oklch, var(--map-building-edge) 55%, var(--map-building))'

/** Selected footprint: 2px `selected` ring on a `background` casing (DESIGN.md §2). */
function SelectedRing({ b }: { b: Rect }) {
  return (
    <g pointerEvents="none">
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill="none" stroke="var(--background)" strokeWidth={6} />
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill="none" stroke="var(--selected)" strokeWidth={2} />
    </g>
  )
}

const Ground = memo(function Ground({ selectedId, onPick }: { selectedId: Id | null; onPick: (id: Id) => void }) {
  const c = CAMPUS_RECT
  const selected = CAMPUS.find((b) => b.id === selectedId)
  return (
    <svg className="absolute inset-0" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <defs>
        <pattern id="map-park-dots" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.2" fill="var(--map-path)" />
        </pattern>
      </defs>
      <rect width={SIZE} height={SIZE} fill="var(--map-road)" />
      {CITY.blocks.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill="var(--map-land)" />
      ))}
      {CITY.parks.map((p, i) => (
        <g key={i}>
          <rect x={p.x + 4} y={p.y + 4} width={p.w - 8} height={p.h - 8} rx={10} fill="var(--map-green)" />
          <rect x={p.x + 4} y={p.y + 4} width={p.w - 8} height={p.h - 8} rx={10} fill="url(#map-park-dots)" opacity={0.5} />
        </g>
      ))}
      {CITY.streets
        .filter((s) => s.major)
        .map((s, i) => {
          const v = s.h > s.w
          return (
            <line
              key={i}
              x1={v ? s.x + s.w / 2 : 0}
              x2={v ? s.x + s.w / 2 : SIZE}
              y1={v ? 0 : s.y + s.h / 2}
              y2={v ? SIZE : s.y + s.h / 2}
              stroke="var(--map-path)"
              strokeDasharray="10 12"
            />
          )
        })}
      {CITY.buildings.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill="var(--map-building)" />
      ))}

      {/* Campus: ground, lawn, footpaths, then tappable demo buildings. */}
      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={16} fill="var(--map-block)" />
      <g stroke="var(--map-path)" strokeWidth={8} strokeLinecap="round" fill="none">
        <path d={`M${c.x + 12} ${c.y + c.h - 12} L${c.x + c.w - 12} ${c.y + 12}`} />
        <path d={`M${c.x + 12} ${c.y + 12} L${c.x + c.w - 12} ${c.y + c.h - 12}`} />
        <path d={`M${c.x + 12} ${c.y + 136} H${c.x + c.w - 12}`} />
        <path d={`M${c.x + 12} ${c.y + 316} H${c.x + c.w - 12}`} />
      </g>
      {CAMPUS.map((b) => (
        <rect
          key={b.id}
          data-building={b.id}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={4}
          fill="var(--map-building)"
          stroke="var(--map-building-edge)"
          strokeWidth={1}
          className="cursor-pointer"
          onClick={() => b.id && onPick(b.id)}
        />
      ))}
      {selected ? <SelectedRing b={selected} /> : null}
    </svg>
  )
})

function RiskOverlay() {
  return (
    <svg className="pointer-events-none absolute inset-0" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
      {demoRiskBlobs.map(([x, y, r, score], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill={riskColor(score)} opacity={0.32} />
      ))}
    </svg>
  )
}

function RouteOverlay({ instant }: { instant: boolean }) {
  const destination = useAppStore((s) => s.destination)
  const travelMode = useAppStore((s) => s.travelMode)
  const routeKind = useAppStore((s) => s.routeKind)
  const view = useAppStore((s) => s.view)
  const active = useAppStore((s) => s.activeRouteId)
  const routes = demoRoutes(destination, travelMode)
  if (!routes.length || (view !== 'directions' && !active)) return null
  const pts = (path: [number, number][]) => path.map((p) => project(p).join(',')).join(' ')
  const chosen = routes.find((r) => (active ? r.id === active : r.kind === routeKind))
  const others = routes.filter((r) => r !== chosen && !active)

  return (
    <svg className="pointer-events-none absolute inset-0" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
      {others.map((r) => (
        <polyline
          key={r.id}
          points={pts(r.path)}
          fill="none"
          stroke="var(--map-building-edge)"
          strokeWidth={6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {chosen ? (
        <g key={`${chosen.id}-${travelMode}`}>
          <polyline points={pts(chosen.path)} fill="none" stroke="var(--background)" strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" />
          {chosen.segments.map((s, i) => {
            const [a, b] = [project(s.path[0]!), project(s.path[1]!)]
            return (
              <motion.line
                key={i}
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke={riskColor(s.score)}
                strokeWidth={8}
                strokeLinecap="round"
                initial={{ pathLength: instant ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: instant ? 0 : 0.35, delay: instant ? 0 : i * 0.3, ease: EASE_SETTLE }}
              />
            )
          })}
        </g>
      ) : null}
    </svg>
  )
}

/** One horizontal slice through every building at least `level` tall. */
function Slice({ level, instant, selectedId }: { level: number; instant: boolean; selectedId: Id | null }) {
  const blocks = ALL_BLOCKS.filter((b) => b.level >= level)
  const selectedTop = blocks.find((b) => b.level === level && b.id !== undefined && b.id === selectedId)
  return (
    <motion.svg
      className="pointer-events-none absolute inset-0"
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      initial={{ z: 0, opacity: 0 }}
      animate={{ z: level * LEVEL_PX, opacity: 1 }}
      exit={{ z: 0, opacity: 0 }}
      transition={{ duration: instant ? 0 : 0.5, ease: EASE_SETTLE }}
    >
      {blocks.map((b, i) => {
        const top = b.level === level
        return (
          <rect
            key={b.id ?? i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={2}
            fill={top ? 'var(--map-building)' : WALL}
            stroke={top ? 'var(--map-building-edge)' : 'none'}
            strokeWidth={top ? 1 : 0}
          />
        )
      })}
      {selectedTop ? <SelectedRing b={selectedTop} /> : null}
    </motion.svg>
  )
}

interface PinSpec {
  key: string
  x: number
  y: number
  label: string
  kind: 'building' | 'poi' | 'event' | 'origin'
  type: string
  onClick?: () => void
  selected: boolean
}

/** 4px gold dot, top right of a cardinal fill or the selected pin (DESIGN.md §2). */
function Keystone({ instant, settle }: { instant: boolean; settle?: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="absolute -top-0.5 -right-0.5 size-1 rounded-full bg-gold ring-1 ring-background"
      initial={settle ? { opacity: 0, y: instant ? 0 : -6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: instant ? 0.2 : 0.3, ease: EASE_EMPHASIS }}
    />
  )
}

/**
 * HTML pins that stay upright and constant size: the outer layer counter-rotates
 * against the camera (CSS transition, matches the tilt), the inner layer
 * counter-scales the zoom (no transition, follows gestures frame by frame).
 */
function Pin({ pin, mode, instant }: { pin: PinSpec; mode: MapMode; instant: boolean }) {
  const cam = CAMERA[mode]
  const tilted = mode !== '2d'
  const style: CSSProperties = {
    left: pin.x,
    top: pin.y,
    transform: `translate(-50%, -100%) translateZ(${tilted ? 60 : 0}px) rotateZ(${-cam.rotateZ}deg) rotateX(${-cam.rotateX}deg) scale(${1 / cam.scale})`,
    transformOrigin: '50% 100%',
    transition: instant ? undefined : `transform ${CAMERA_S}s cubic-bezier(0.22, 1, 0.36, 1)`,
  }
  const counterZoom: CSSProperties = { transform: 'scale(calc(1 / var(--map-zoom, 1)))', transformOrigin: '50% 100%' }
  const grow = { scale: pin.selected ? 1.25 : 1 }
  const growT = { duration: instant ? 0 : 0.3, ease: EASE_SETTLE }

  if (pin.kind === 'origin') {
    return (
      <div className="pointer-events-none absolute" style={style} aria-label="Your location" role="img">
        <div style={counterZoom}>
          <span className="relative mb-1 block size-5 rounded-full border-4 border-background bg-brand shadow-chip">
            <Keystone instant={instant} />
          </span>
        </div>
      </div>
    )
  }
  if (pin.kind === 'building') {
    return (
      <div className="absolute" style={style}>
        <div style={counterZoom}>
          <button
            type="button"
            data-pin={pin.key}
            onClick={pin.onClick}
            aria-pressed={pin.selected}
            className="flex min-h-tap flex-col items-center justify-end outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-ring"
          >
            <span
              className={
                pin.selected
                  ? 'caption-3 relative rounded-full bg-selected px-3 py-1 whitespace-nowrap text-selected-foreground shadow-chip'
                  : 'caption-4 rounded-full px-2 py-0.5 whitespace-nowrap text-map-label [text-shadow:0_0_2px_var(--map-label-halo),0_0_2px_var(--map-label-halo),0_0_4px_var(--map-label-halo)]'
              }
            >
              {pin.label}
              {pin.selected ? <Keystone instant={instant} settle /> : null}
            </span>
            <span aria-hidden className={pin.selected ? 'h-2 w-0.5 bg-selected' : 'h-1 w-px bg-map-building-edge'} />
          </button>
        </div>
      </div>
    )
  }
  const emergency = pin.type === 'blue_light' || pin.type === 'dps'
  return (
    <div className="absolute" style={style}>
      <div style={counterZoom}>
        <button
          type="button"
          data-pin={pin.key}
          aria-label={pin.label}
          aria-pressed={pin.selected}
          onClick={pin.onClick}
          className="grid size-tap place-items-end justify-center outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-ring"
        >
          <motion.span
            className={
              'relative grid size-8 origin-bottom place-items-center rounded-full shadow-chip [&_svg]:size-4 ' +
              (pin.selected
                ? 'bg-selected text-selected-foreground'
                : emergency
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-foreground')
            }
            initial={false}
            animate={grow}
            transition={growT}
          >
            {pin.kind === 'event' ? <CalendarDots aria-hidden weight={pin.selected ? 'fill' : 'regular'} /> : <PinIcon type={pin.type} selected={pin.selected} />}
            {pin.selected ? <Keystone instant={instant} settle /> : null}
          </motion.span>
        </button>
      </div>
    </div>
  )
}

function poiLayer(p: Poi): string | null {
  if (p.type === 'blue_light') return 'demo-bluelights'
  if (p.type === 'parking' || p.type === 'bike_rack') return 'demo-transit'
  return null
}

type Pt = { x: number; y: number }
const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) })

/** Pan / zoom camera on three motion values. Gestures write directly; commands animate. */
function useCamera(containerRef: RefObject<HTMLDivElement | null>, tilt: Tilt, offset: Pt, reduce: boolean) {
  const cx = useMotionValue(HOME.cx)
  const cy = useMotionValue(HOME.cy)
  const zoom = useMotionValue(HOME.zoom)
  const target = useRef<View>(HOME)
  const running = useRef<AnimationPlaybackControls[]>([])
  const live = useRef({ tilt, offset, reduce })
  useEffect(() => {
    live.current = { tilt, offset, reduce }
  }, [tilt, offset, reduce])

  const stop = useCallback(() => {
    running.current.forEach((a) => a.stop())
    running.current = []
  }, [])

  const bounds = useCallback(() => {
    const el = containerRef.current
    return { size: SIZE, viewportW: el?.clientWidth ?? SIZE, viewportH: el?.clientHeight ?? SIZE }
  }, [containerRef])

  /** Set the camera. `duration` 0 (or reduced motion) jumps; otherwise eases. */
  const go = useCallback(
    (next: View, duration = 0) => {
      const v = clampView(next, bounds(), live.current.tilt)
      target.current = v
      stop()
      if (duration === 0 || live.current.reduce) {
        cx.set(v.cx)
        cy.set(v.cy)
        zoom.set(v.zoom)
        return
      }
      const t = { duration, ease: EASE_SETTLE }
      running.current = [animate(cx, v.cx, t), animate(cy, v.cy, t), animate(zoom, v.zoom, t)]
    },
    [bounds, cx, cy, zoom, stop],
  )

  /** Screen point (client px) to offset from the view centre's screen position. */
  const anchor = useCallback(
    (clientX: number, clientY: number): [number, number] => {
      const r = containerRef.current?.getBoundingClientRect()
      if (!r) return [0, 0]
      return [clientX - r.left - r.width / 2 - live.current.offset.x, clientY - r.top - r.height / 2 - live.current.offset.y]
    },
    [containerRef],
  )

  // Re-clamp when the viewport or the tilt changes.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => go(target.current))
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, go])
  useEffect(() => go(target.current), [tilt, go])

  return { cx, cy, zoom, target, go, anchor, stop }
}

export function MapView() {
  const mapMode = useAppStore((s) => s.mapMode)
  const selection = useAppStore((s) => s.selection)
  const select = useAppStore((s) => s.select)
  const overrides = useAppStore((s) => s.layerOverrides)
  const panelOpen = useAppStore((s) => s.panelOpen)
  const breakpoint = useBreakpoint()
  const reduce = useReducedMotion() ?? false
  const tilted = mapMode !== '2d'
  const tilt = CAMERA[mapMode]
  const on = (id: string) => overrides[id] ?? demoLayerDefaults[id] ?? false
  const selectedId = selection?.id ?? null

  // Keep the view centre in the part of the map that is not under the panel or sheet.
  const offsetX = breakpoint === 'desktop' && panelOpen ? SIDE_PANEL_PX / 2 : 0
  const offsetY = breakpoint === 'desktop' ? 30 : 40
  const offset = useMemo(() => ({ x: offsetX, y: offsetY }), [offsetX, offsetY])

  const containerRef = useRef<HTMLDivElement>(null)
  const cam = useCamera(containerRef, tilt, offset, reduce)
  const { go, anchor, stop, target } = cam
  const planeTransform = useTransform(
    [cam.cx, cam.cy, cam.zoom],
    ([x, y, z]: number[]) => `scale(${z}) translate(${SIZE / 2 - x!}px, ${SIZE / 2 - y!}px)`,
  )

  useEffect(
    () =>
      registerMapController({
        recenter: () => go(LOCATE, CAMERA_S),
        zoomBy: (f) => go({ ...target.current, zoom: target.current.zoom * f }, 0.3),
      }),
    [go, target],
  )

  // ── Gestures ──────────────────────────────────────────────────────────────
  const pointers = useRef(new Map<number, Pt>())
  const drag = useRef<{ start: Pt; last: Pt; moved: boolean; pinch: ReturnType<typeof mid> | null } | null>(null)
  const suppressClick = useRef(false)
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)

  const setDragging = (v: boolean) => {
    const el = containerRef.current
    if (el) el.dataset.dragging = v ? 'true' : 'false'
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    stop()
    const p = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, p)
    suppressClick.current = false
    if (pointers.current.size === 1) {
      drag.current = { start: p, last: p, moved: false, pinch: null }
    } else if (pointers.current.size === 2 && drag.current) {
      const [a, b] = [...pointers.current.values()]
      const m = mid(a!, b!)
      const [mx, my] = anchor(m.x, m.y)
      drag.current = { ...drag.current, moved: true, pinch: { x: mx, y: my, dist: m.dist } }
      for (const id of pointers.current.keys()) e.currentTarget.setPointerCapture?.(id)
      setDragging(true)
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || !pointers.current.has(e.pointerId)) return
    const p = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, p)

    if (pointers.current.size >= 2 && d.pinch) {
      const [a, b] = [...pointers.current.values()]
      const m = mid(a!, b!)
      const [mx, my] = anchor(m.x, m.y)
      const next = { x: mx, y: my, dist: m.dist }
      go(pinch(target.current, { mx: d.pinch.x, my: d.pinch.y, dist: d.pinch.dist }, { mx: next.x, my: next.y, dist: next.dist }, tilt))
      d.pinch = next
      return
    }
    if (!d.moved) {
      if (!isDrag(p.x - d.start.x, p.y - d.start.y)) return
      d.moved = true
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setDragging(true)
    }
    go(pan(target.current, p.x - d.last.x, p.y - d.last.y, tilt))
    d.last = p
  }

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return
    const d = drag.current
    if (!d) return
    if (pointers.current.size === 1) {
      // Pinch ended with one finger down: keep panning from that finger.
      const rest = [...pointers.current.values()][0]!
      drag.current = { start: rest, last: rest, moved: true, pinch: null }
      return
    }
    if (pointers.current.size > 0) return
    drag.current = null
    setDragging(false)
    if (d.moved) {
      suppressClick.current = true
      lastTap.current = null
      return
    }
    if (e.type !== 'pointerup' || (e.target as Element).closest('button')) return
    const tap = { t: e.timeStamp, x: e.clientX, y: e.clientY }
    if (isDoubleTap(lastTap.current, tap)) {
      lastTap.current = null
      const [ax, ay] = anchor(tap.x, tap.y)
      go(zoomAt(target.current, e.shiftKey ? 0.5 : 2, ax, ay, tilt), 0.3)
    } else {
      lastTap.current = tap
    }
  }

  const onClickCapture = (e: MouseEvent) => {
    if (!suppressClick.current) return
    suppressClick.current = false
    e.stopPropagation()
    e.preventDefault()
  }

  // Wheel needs a non-passive listener to stop page zoom / scroll.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1)
      // ctrlKey = trackpad pinch: small deltas, follow them directly.
      const factor = wheelFactor(e.ctrlKey ? px * 4 : px)
      const [ax, ay] = anchor(e.clientX, e.clientY)
      go(zoomAt(target.current, factor, ax, ay, CAMERA[useAppStore.getState().mapMode]), e.ctrlKey ? 0 : 0.15)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [anchor, go, target])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const step = e.shiftKey ? KEY_PAN_PX * 3 : KEY_PAN_PX
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    const m = moves[e.key]
    if (m) {
      e.preventDefault()
      go(pan(target.current, m[0], m[1], tilt), 0.2)
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      go(zoomAt(target.current, 1.5, 0, 0, tilt), 0.3)
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      go(zoomAt(target.current, 1 / 1.5, 0, 0, tilt), 0.3)
    }
  }

  const pins = useMemo<PinSpec[]>(() => {
    const out: PinSpec[] = []
    out.push({ key: 'origin', x: ORIGIN_X, y: ORIGIN_Y, label: 'Your location', kind: 'origin', type: 'origin', selected: false })
    for (const p of demoPois) {
      const layer = poiLayer(p)
      if (layer && !on(layer)) continue
      const [x, y] = project(p.lngLat)
      out.push({
        key: p.id,
        x,
        y,
        label: p.name ?? p.type,
        kind: 'poi',
        type: p.type,
        selected: selectedId === p.id,
        onClick: () => select({ kind: 'poi', id: p.id }),
      })
    }
    if (on('demo-events'))
      for (const e of demoEvents) {
        const b = CAMPUS.find((c) => c.id === e.buildingId)
        if (!b) continue
        out.push({
          key: e.id,
          x: b.x + b.w - 10,
          y: b.y + 12,
          label: e.title,
          kind: 'event',
          type: 'event',
          selected: selectedId === e.id,
          onClick: () => select({ kind: 'event', id: e.id }),
        })
      }
    for (const b of demoBuildings) {
      const r = CAMPUS.find((c) => c.id === b.id)!
      out.push({
        key: b.id,
        x: r.x + r.w / 2,
        y: r.y + r.h / 2,
        label: b.name,
        kind: 'building',
        type: 'building',
        selected: selectedId === b.id,
        onClick: () => select({ kind: 'building', id: b.id }),
      })
    }
    // Selected pin last so it paints above its neighbours.
    return out.sort((a, b) => Number(a.selected) - Number(b.selected))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `on` reads overrides
  }, [overrides, selectedId, select])

  return (
    <div
      ref={containerRef}
      data-testid="map"
      data-mode={mapMode}
      role="application"
      tabIndex={0}
      aria-roledescription="map"
      aria-label={`Campus map preview, ${mapMode === '2d' ? '2D' : mapMode === 'iso' ? 'isometric' : '3D'} view. Drag to pan, arrow keys to move, plus and minus to zoom.`}
      className="absolute inset-0 z-(--z-map) cursor-grab touch-none overflow-hidden bg-map-land outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[dragging=true]:cursor-grabbing"
      style={{ perspective: 1400 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={onClickCapture}
      onKeyDown={onKeyDown}
    >
      <motion.div
        className="absolute top-1/2 left-1/2"
        style={{ width: SIZE, height: SIZE, marginLeft: -SIZE / 2, marginTop: -SIZE / 2, transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ x: offsetX, y: offsetY, ...tilt }}
        transition={{ duration: reduce ? 0 : CAMERA_S, ease: EASE_SETTLE }}
      >
        <motion.div
          className="absolute inset-0"
          style={{ transform: planeTransform, transformStyle: 'preserve-3d', ['--map-zoom' as string]: cam.zoom }}
        >
          <Ground selectedId={selectedId} onPick={(id) => select({ kind: 'building', id })} />
          {on('demo-safety') ? <RiskOverlay /> : null}
          <RouteOverlay instant={reduce} />
          <AnimatePresence>
            {tilted
              ? Array.from({ length: LEVELS }, (_, i) => <Slice key={i + 1} level={i + 1} instant={reduce} selectedId={selectedId} />)
              : null}
          </AnimatePresence>
          {pins.map((p) => (
            <Pin key={p.key} pin={p} mode={mapMode} instant={reduce} />
          ))}
        </motion.div>
      </motion.div>
      {/* Horizon fog: hides the plane edge when tilted. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-map-land to-transparent"
        initial={false}
        animate={{ opacity: tilted ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : 0.2 }}
      />
    </div>
  )
}
