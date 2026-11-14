import { CalendarDays } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { memo, useMemo, type CSSProperties } from 'react'
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
import { PlaceIcon, SIDE_PANEL_PX, useBreakpoint } from '@/ui'

/**
 * The ONLY map instance in the app.
 *
 * Placeholder until the map lane mounts MapLibre + deck.gl here: a themed,
 * procedurally drawn city around a demo campus. Campus buildings and pins are
 * tappable and set the selection; the demo route draws when directions are
 * open. `mapMode` tilts the plane with CSS 3D; iso and 3D stack roof slices
 * to fake extrusion. No tiles, no network.
 */

const SIZE = PLANE
const LEVELS = 6
const LEVEL_PX = 7
const EASE_SETTLE = [0.22, 1, 0.36, 1] as const
const CAMERA_S = 0.8

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

const CAMERA: Record<MapMode, { rotateX: number; rotateZ: number; scale: number }> = {
  '2d': { rotateX: 0, rotateZ: 0, scale: 1 },
  iso: { rotateX: 52, rotateZ: -38, scale: 1.05 },
  '3d': { rotateX: 62, rotateZ: -16, scale: 1.4 },
}

/** Monochrome, theme-driven palette. Hue on the map is reserved for data (risk, route, selection). */
const palette = {
  '--map-street': 'var(--background)',
  '--map-block': 'color-mix(in oklch, var(--foreground) 5%, var(--background))',
  '--map-park': 'color-mix(in oklch, var(--foreground) 9%, var(--background))',
  '--map-footprint': 'color-mix(in oklch, var(--foreground) 14%, var(--background))',
  '--map-campus': 'color-mix(in oklch, var(--foreground) 22%, var(--background))',
  '--map-wall': 'color-mix(in oklch, var(--foreground) 18%, var(--background))',
  '--map-roof': 'color-mix(in oklch, var(--foreground) 26%, var(--background))',
  '--map-edge': 'color-mix(in oklch, var(--foreground) 34%, var(--background))',
} as CSSProperties

const Ground = memo(function Ground({ selectedId, onPick }: { selectedId: Id | null; onPick: (id: Id) => void }) {
  const c = CAMPUS_RECT
  return (
    <svg className="absolute inset-0" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <defs>
        <pattern id="map-park-dots" width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.2" fill="var(--map-footprint)" />
        </pattern>
      </defs>
      <rect width={SIZE} height={SIZE} fill="var(--map-street)" />
      {CITY.blocks.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill="var(--map-block)" />
      ))}
      {CITY.parks.map((p, i) => (
        <g key={i}>
          <rect x={p.x + 4} y={p.y + 4} width={p.w - 8} height={p.h - 8} rx={10} fill="var(--map-park)" />
          <rect x={p.x + 4} y={p.y + 4} width={p.w - 8} height={p.h - 8} rx={10} fill="url(#map-park-dots)" />
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
              stroke="var(--map-block)"
              strokeDasharray="10 12"
            />
          )
        })}
      {CITY.buildings.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill="var(--map-footprint)" />
      ))}

      {/* Campus: lawn, footpaths, then tappable demo buildings. */}
      <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={16} fill="var(--map-park)" />
      <g stroke="var(--map-street)" strokeWidth={8} strokeLinecap="round" fill="none">
        <path d={`M${c.x + 12} ${c.y + c.h - 12} L${c.x + c.w - 12} ${c.y + 12}`} />
        <path d={`M${c.x + 12} ${c.y + 12} L${c.x + c.w - 12} ${c.y + c.h - 12}`} />
        <path d={`M${c.x + 12} ${c.y + 136} H${c.x + c.w - 12}`} />
        <path d={`M${c.x + 12} ${c.y + 316} H${c.x + c.w - 12}`} />
      </g>
      {CAMPUS.map((b) => {
        const selected = b.id === selectedId
        return (
          <rect
            key={b.id}
            data-building={b.id}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={4}
            fill="var(--map-campus)"
            stroke={selected ? 'var(--ring)' : 'var(--map-edge)'}
            strokeWidth={selected ? 4 : 1}
            className="cursor-pointer"
            onClick={() => b.id && onPick(b.id)}
          />
        )
      })}
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
        <polyline key={r.id} points={pts(r.path)} fill="none" stroke="var(--map-edge)" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
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
      {ALL_BLOCKS.filter((b) => b.level >= level).map((b, i) => {
        const top = b.level === level
        const selected = b.id !== undefined && b.id === selectedId
        return (
          <rect
            key={b.id ?? i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={2}
            fill={top ? (b.id ? 'var(--map-campus)' : 'var(--map-roof)') : 'var(--map-wall)'}
            stroke={top ? (selected ? 'var(--ring)' : 'var(--map-edge)') : 'none'}
            strokeWidth={top ? (selected ? 4 : 1) : 0}
          />
        )
      })}
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

/** HTML pins that stay upright: counter-rotate against the camera, lifted above roofs when tilted. */
function Pin({ pin, mode }: { pin: PinSpec; mode: MapMode }) {
  const cam = CAMERA[mode]
  const tilted = mode !== '2d'
  const transform = `translate(-50%, -100%) translateZ(${tilted ? 60 : 0}px) rotateZ(${-cam.rotateZ}deg) rotateX(${-cam.rotateX}deg) scale(${1 / cam.scale})`
  const style: CSSProperties = {
    left: pin.x,
    top: pin.y,
    transform,
    transformOrigin: '50% 100%',
    transition: `transform ${CAMERA_S}s cubic-bezier(0.22, 1, 0.36, 1)`,
  }

  if (pin.kind === 'origin') {
    return (
      <div className="pointer-events-none absolute" style={style} aria-label="Your location" role="img">
        <span className="mb-1 block size-5 rounded-full border-4 border-background bg-primary shadow-float" />
      </div>
    )
  }
  if (pin.kind === 'building') {
    return (
      <button
        type="button"
        data-pin={pin.key}
        onClick={pin.onClick}
        aria-pressed={pin.selected}
        className="absolute flex min-h-tap flex-col items-center justify-end outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-ring"
        style={style}
      >
        <span
          className={
            pin.selected
              ? 'caption-3 rounded-full bg-primary px-3 py-1 whitespace-nowrap text-primary-foreground shadow-float'
              : 'caption-4 rounded-full border border-border bg-glass px-2 py-0.5 whitespace-nowrap text-foreground backdrop-blur-glass'
          }
        >
          {pin.label}
        </span>
        <span aria-hidden className={pin.selected ? 'h-2 w-0.5 bg-primary' : 'h-1 w-px bg-border'} />
      </button>
    )
  }
  return (
    <button
      type="button"
      data-pin={pin.key}
      aria-label={pin.label}
      aria-pressed={pin.selected}
      onClick={pin.onClick}
      className="absolute grid size-tap place-items-end justify-center outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-ring"
      style={style}
    >
      <span
        className={
          'grid size-8 place-items-center rounded-full border-2 border-background shadow-float [&_svg]:size-4 ' +
          (pin.selected
            ? 'bg-primary text-primary-foreground'
            : pin.type === 'blue_light' || pin.type === 'dps'
              ? 'bg-foreground text-background'
              : 'bg-card text-foreground')
        }
      >
        {pin.kind === 'event' ? <CalendarDays aria-hidden /> : <PlaceIcon type={pin.type} />}
      </span>
    </button>
  )
}

function poiLayer(p: Poi): string | null {
  if (p.type === 'blue_light') return 'demo-bluelights'
  if (p.type === 'parking' || p.type === 'bike_rack') return 'demo-transit'
  return null
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
  const on = (id: string) => overrides[id] ?? demoLayerDefaults[id] ?? false
  const selectedId = selection?.id ?? null

  const pins = useMemo<PinSpec[]>(() => {
    const out: PinSpec[] = []
    const [ox, oy] = project(ORIGIN)
    out.push({ key: 'origin', x: ox, y: oy, label: 'Your location', kind: 'origin', type: 'origin', selected: false })
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
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `on` reads overrides
  }, [overrides, selectedId, select])

  // Keep the campus centred in the part of the map that is not under the panel or sheet.
  const campusDy = SIZE / 2 - (CAMPUS_RECT.y + CAMPUS_RECT.h / 2)
  const offsetX = breakpoint === 'desktop' && panelOpen ? SIDE_PANEL_PX / 2 : 0
  const offsetY = campusDy + (breakpoint === 'desktop' ? 30 : 40)

  return (
    <div
      data-testid="map"
      data-mode={mapMode}
      role="application"
      aria-label={`Campus map preview, ${mapMode === '2d' ? '2D' : mapMode === 'iso' ? 'isometric' : '3D'} view`}
      className="absolute inset-0 z-(--z-map) overflow-hidden bg-(--map-block) select-none"
      style={{ ...palette, perspective: 1400 }}
    >
      <motion.div
        className="absolute top-1/2 left-1/2"
        style={{ width: SIZE, height: SIZE, marginLeft: -SIZE / 2, marginTop: -SIZE / 2, transformStyle: 'preserve-3d' }}
        initial={false}
        animate={{ x: offsetX, y: offsetY, ...CAMERA[mapMode] }}
        transition={{ duration: reduce ? 0 : CAMERA_S, ease: EASE_SETTLE }}
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
          <Pin key={p.key} pin={p} mode={mapMode} />
        ))}
      </motion.div>
      {/* Horizon fog: hides the plane edge when tilted. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-background to-transparent"
        initial={false}
        animate={{ opacity: tilted ? 1 : 0 }}
        transition={{ duration: 0.2 }}
      />
    </div>
  )
}
