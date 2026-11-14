import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { CSSProperties } from 'react'
import type { MapMode } from '@/domain'
import { useAppStore } from '@/state/store'

/**
 * The ONLY map instance in the app.
 *
 * Placeholder until the map lane mounts MapLibre + deck.gl here: a static,
 * themed, procedurally drawn city (streets, blocks, parks, building footprints).
 * `mapMode` tilts the plane with CSS 3D; iso and 3D stack roof slices to fake
 * extrusion. No tiles, no network.
 */

const SIZE = 1600
const LEVELS = 5
const LEVEL_PX = 7

interface Rect {
  x: number
  y: number
  w: number
  h: number
}
interface Building extends Rect {
  /** 1..LEVELS */
  level: number
}
interface City {
  streets: (Rect & { major: boolean })[]
  blocks: Rect[]
  parks: Rect[]
  buildings: Building[]
}

/** Deterministic PRNG so the placeholder city never reshuffles. */
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

function buildCity(): City {
  const rand = mulberry32(20261114)
  const cols = lines(rand)
  const rows = lines(rand)
  const streets: City['streets'] = [
    ...cols.map((c, i) => ({ x: c.at, y: 0, w: c.width, h: SIZE, major: i % 3 === 0 })),
    ...rows.map((r, i) => ({ x: 0, y: r.at, w: SIZE, h: r.width, major: i % 3 === 0 })),
  ]
  const blocks: Rect[] = []
  const parks: Rect[] = []
  const buildings: Building[] = []

  const pairs = <T,>(xs: T[]) => xs.slice(1).map((next, i) => [xs[i]!, next] as const)
  for (const [c0, c1] of pairs(cols)) {
    for (const [r0, r1] of pairs(rows)) {
      const x = c0.at + c0.width
      const y = r0.at + r0.width
      const block = { x, y, w: c1.at - x, h: r1.at - y }
      blocks.push(block)
      if (rand() < 0.09) {
        parks.push(block)
        continue
      }
      const nx = block.w > 150 ? 3 : 2
      const ny = rand() < 0.5 ? 1 : 2
      const inset = 8
      const gap = 6
      const lw = (block.w - inset * 2 - gap * (nx - 1)) / nx
      const lh = (block.h - inset * 2 - gap * (ny - 1)) / ny
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          if (rand() < 0.18) continue
          const shrink = rand() < 0.3 ? 0.7 : 1
          const r = rand()
          buildings.push({
            x: block.x + inset + i * (lw + gap),
            y: block.y + inset + j * (lh + gap),
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

const CAMERA: Record<MapMode, { rotateX: number; rotateZ: number; scale: number }> = {
  '2d': { rotateX: 0, rotateZ: 0, scale: 1 },
  iso: { rotateX: 52, rotateZ: -38, scale: 1.05 },
  '3d': { rotateX: 62, rotateZ: -16, scale: 1.4 },
}

/** Monochrome, theme-driven palette. Hue on the map is reserved for risk data. */
const palette = {
  '--map-street': 'var(--background)',
  '--map-block': 'color-mix(in oklch, var(--foreground) 5%, var(--background))',
  '--map-park': 'color-mix(in oklch, var(--foreground) 9%, var(--background))',
  '--map-footprint': 'color-mix(in oklch, var(--foreground) 14%, var(--background))',
  '--map-wall': 'color-mix(in oklch, var(--foreground) 18%, var(--background))',
  '--map-roof': 'color-mix(in oklch, var(--foreground) 26%, var(--background))',
  '--map-edge': 'color-mix(in oklch, var(--foreground) 34%, var(--background))',
} as CSSProperties

function Ground() {
  return (
    <svg className="absolute inset-0" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
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
          const vertical = s.h > s.w
          return (
            <line
              key={i}
              x1={vertical ? s.x + s.w / 2 : 0}
              x2={vertical ? s.x + s.w / 2 : SIZE}
              y1={vertical ? 0 : s.y + s.h / 2}
              y2={vertical ? SIZE : s.y + s.h / 2}
              stroke="var(--map-block)"
              strokeWidth={1}
              strokeDasharray="10 12"
            />
          )
        })}
      {CITY.buildings.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill="var(--map-footprint)" />
      ))}
    </svg>
  )
}

/** One horizontal slice through every building at least `level` tall. */
function Slice({ level, instant }: { level: number; instant: boolean }) {
  const top = (b: Building) => b.level === level
  return (
    <motion.svg
      className="absolute inset-0"
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      aria-hidden
      initial={{ z: 0, opacity: 0 }}
      animate={{ z: level * LEVEL_PX, opacity: 1 }}
      exit={{ z: 0, opacity: 0 }}
      transition={{ duration: instant ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {CITY.buildings
        .filter((b) => b.level >= level)
        .map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={2}
            fill={top(b) ? 'var(--map-roof)' : 'var(--map-wall)'}
            stroke={top(b) ? 'var(--map-edge)' : 'none'}
            strokeWidth={top(b) ? 1 : 0}
          />
        ))}
    </motion.svg>
  )
}

export function MapView() {
  const mapMode = useAppStore((s) => s.mapMode)
  const reduce = useReducedMotion() ?? false
  const tilted = mapMode !== '2d'

  return (
    <div
      data-testid="map"
      data-mode={mapMode}
      role="img"
      aria-label={`Map preview, ${mapMode === '2d' ? '2D' : mapMode === 'iso' ? 'isometric' : '3D'} view`}
      className="absolute inset-0 z-(--z-map) overflow-hidden bg-(--map-block) select-none"
      style={{ ...palette, perspective: 1400 }}
    >
      <motion.div
        className="absolute top-1/2 left-1/2"
        style={{
          width: SIZE,
          height: SIZE,
          marginLeft: -SIZE / 2,
          marginTop: -SIZE / 2,
          transformStyle: 'preserve-3d',
        }}
        initial={false}
        animate={CAMERA[mapMode]}
        transition={{ duration: reduce ? 0 : 0.8, ease: [0.34, 1.3, 0.64, 1] }}
      >
        <Ground />
        <AnimatePresence>
          {tilted
            ? Array.from({ length: LEVELS }, (_, i) => <Slice key={i + 1} level={i + 1} instant={reduce} />)
            : null}
        </AnimatePresence>
      </motion.div>
      {/* Horizon fog: hides the plane edge when tilted, and keeps chrome readable. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-background via-background/60 to-transparent"
        initial={false}
        animate={{ opacity: tilted ? 1 : 0.35 }}
        transition={{ duration: 0.2 }}
      />
    </div>
  )
}
