import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LngLat, Route, RouteStep } from '@/domain'
import {
  angleDelta,
  bearingDeg,
  chooseHeading,
  compassWord,
  distanceM,
  followingStep,
  fromLocal,
  headingFromOrientation,
  ingestFix,
  initialTracker,
  lowPassAngle,
  measure,
  nextStepIndex,
  pointAlong,
  predictAlong,
  progressAt,
  simulatedWalk,
  snapToPath,
  stepInstruction,
  type RawFix,
  type TrackerOptions,
} from '.'

const O: LngLat = [-118.2852, 34.0187]
const at = (east: number, north: number) => fromLocal(O, east, north)
/** 100 m north, then 100 m east. */
const path: LngLat[] = [at(0, 0), at(0, 100), at(100, 100)]
const cum = measure(path)

const steps: RouteStep[] = [
  { maneuver: 'depart', at: path[0]!, offsetM: 0, distanceM: 100, name: 'Trousdale Pkwy' },
  { maneuver: 'right', at: path[1]!, offsetM: 100, distanceM: 100, name: 'Childs Way' },
  { maneuver: 'arrive', at: path[2]!, offsetM: 200, distanceM: 0 },
]
const route: Route = {
  id: 'r',
  kind: 'safest',
  path,
  durationS: 200,
  distanceM: 200,
  risk: { mean: 0.1, max: 0.2 },
  segments: [],
  warnings: [],
  steps,
}

describe('geo', () => {
  it('measures, bears and wraps angles', () => {
    expect(cum[2]).toBeCloseTo(200, 0)
    expect(distanceM(path[0]!, path[1]!)).toBeCloseTo(100, 1)
    expect(bearingDeg(path[0]!, path[1]!)).toBeCloseTo(0, 0)
    expect(bearingDeg(path[1]!, path[2]!)).toBeCloseTo(90, 0)
    expect(angleDelta(350, 10)).toBe(20)
    expect(angleDelta(10, 350)).toBe(-20)
  })

  it('finds the point a distance along, clamped to the ends', () => {
    const p = pointAlong(path, cum, 150)
    expect(distanceM(p.point, at(50, 100))).toBeLessThan(0.5)
    expect(p.bearingDeg).toBeCloseTo(90, 0)
    expect(distanceM(pointAlong(path, cum, 999).point, path[2]!)).toBeLessThan(0.01)
    expect(distanceM(pointAlong(path, cum, -5).point, path[0]!)).toBeLessThan(0.01)
  })

  it('snaps a position to the nearest point on the route', () => {
    const s = snapToPath(path, cum, at(8, 40))
    expect(s.alongM).toBeCloseTo(40, 0)
    expect(s.offRouteM).toBeCloseTo(8, 0)
  })

  it('prefers the part of the route near the last progress on an out and back', () => {
    const back: LngLat[] = [at(0, 0), at(0, 300), at(4, 0)]
    const c = measure(back)
    expect(snapToPath(back, c, at(2, 20), { nearM: 570 }).alongM).toBeGreaterThan(300)
    expect(snapToPath(back, c, at(2, 20), { nearM: 20 }).alongM).toBeLessThan(300)
  })
})

describe('steps and progress', () => {
  it('looks up the next and following step', () => {
    expect(nextStepIndex(steps, 0)).toBe(1)
    expect(nextStepIndex(steps, 98)).toBe(2)
    expect(nextStepIndex(steps, 150)).toBe(2)
    expect(nextStepIndex([], 10)).toBe(0)
    expect(followingStep(steps, 1)?.maneuver).toBe('arrive')
    expect(followingStep(steps, 2)).toBeUndefined()
  })

  it('reports distance to the next maneuver, what is left and arrival', () => {
    const p = progressAt(route, cum, 40)
    expect(p).toMatchObject({ stepIndex: 1, arrived: false })
    expect(p.toStepM).toBeCloseTo(60, 0)
    expect(p.remainingM).toBeCloseTo(160, 0)
    expect(p.remainingS).toBe(160)
    expect(p.headingDeg).toBeCloseTo(0, 0)
    const end = progressAt(route, cum, 195)
    expect(end).toMatchObject({ arrived: true, remainingM: 0, remainingS: 0, stepIndex: 2 })
  })
})

describe('instructions', () => {
  it('reads like car navigation', () => {
    expect(stepInstruction(steps[0]!, { departBearingDeg: 2 })).toBe('Head north on Trousdale Pkwy')
    expect(stepInstruction(steps[1]!)).toBe('Turn right onto Childs Way')
    expect(stepInstruction({ ...steps[1]!, maneuver: 'slight-left', name: undefined })).toBe('Bear left')
    expect(stepInstruction(steps[2]!, { destinationName: 'Doheny Memorial Library' })).toBe('Arrive at Doheny Memorial Library')
    expect(compassWord(-90)).toBe('west')
  })
})

describe('tracker', () => {
  const o: TrackerOptions = { path, cum }
  const fix = (north: number, t: number, extra: Partial<RawFix> = {}): RawFix => ({ lngLat: at(0, north), accuracyM: 5, t, ...extra })
  const feed = (fixes: RawFix[], opts = o) => fixes.reduce((s, f) => ingestFix(s, f, opts).state, initialTracker)

  it('dead reckons between fixes and stops a little past the expected next fix', () => {
    const s = feed([fix(0, 0, { speedMps: 1.5 }), fix(1.5, 1000, { speedMps: 1.5 }), fix(3, 2000, { speedMps: 1.5 })])
    const half = predictAlong(s, 2500, o)
    expect(half).toBeGreaterThan(3.2)
    expect(half).toBeLessThan(4.2)
    // Fixes stop: prediction caps near 1.25 intervals ahead instead of running on.
    expect(predictAlong(s, 30_000, o)).toBeLessThan(3 + 1.5 * 1.25 + 0.5)
  })

  it('keeps the shown position continuous when a fix disagrees, then eases to it', () => {
    let s = feed([fix(0, 0, { speedMps: 1.5 }), fix(1.5, 1000, { speedMps: 1.5 })])
    const before = predictAlong(s, 2000, o)
    s = ingestFix(s, fix(1.5, 2000, { speedMps: 0 }), o).state
    expect(predictAlong(s, 2000, o)).toBeCloseTo(before, 5)
    // A few time constants later the correction has eased out.
    expect(predictAlong(s, 6000, o)).toBeCloseTo(predictAlong({ ...s, corrM: 0 }, 6000, o), 1)
  })

  it('drops low accuracy and impossible jumps, but re-anchors when they persist', () => {
    let s = feed([fix(0, 0), fix(1, 1000)])
    let r = ingestFix(s, fix(2, 2000, { accuracyM: 200 }), o)
    expect(r.accepted).toBe(false)
    s = r.state
    r = ingestFix(s, fix(90, 3000), o)
    expect(r.accepted).toBe(false)
    r = ingestFix(r.state, fix(91, 4000), o)
    expect(r.accepted).toBe(true)
    expect(r.state.baseM).toBeCloseTo(91, 0)
  })

  it('with prediction off just follows the filtered fixes', () => {
    const off = { ...o, predict: false }
    const s = feed([fix(0, 0, { speedMps: 1.5 }), fix(2, 1000, { speedMps: 1.5 })], off)
    expect(predictAlong(s, 1500, off)).toBe(predictAlong(s, 9000, off))
  })

  it('low-passes heading the short way round north', () => {
    expect(lowPassAngle(350, 10, 10)).toBeCloseTo(10, 3)
    const mid = lowPassAngle(350, 10, 0.35)
    expect(mid > 350 || mid < 10).toBe(true)
  })

  it('chooses compass, then GPS course when moving, then route bearing', () => {
    const base = { speedMps: 1.4, routeBearingDeg: 90, now: 10_000 }
    expect(chooseHeading({ ...base, compass: { deg: 45, t: 9_500 }, courseDeg: 10 })).toBe(45)
    expect(chooseHeading({ ...base, compass: { deg: 45, t: 1_000 }, courseDeg: 10 })).toBe(10)
    expect(chooseHeading({ ...base, speedMps: 0.2, courseDeg: 10 })).toBe(90)
  })
})

describe('compass', () => {
  it('reads iOS and Android orientation events', () => {
    expect(headingFromOrientation({ alpha: 10, webkitCompassHeading: 30 })).toBe(30)
    expect(headingFromOrientation({ alpha: 90, absolute: true })).toBe(270)
    expect(headingFromOrientation({ alpha: 90, absolute: true }, 90)).toBe(0)
    expect(headingFromOrientation({ alpha: 90, absolute: false })).toBeNull()
  })
})

describe('simulated walk', () => {
  afterEach(() => vi.useRealTimers())

  it('walks at the set speed, holds while paused, and resumes in place', () => {
    vi.useFakeTimers()
    let t = 0
    let paused = false
    const fixes: RawFix[] = []
    const walk = simulatedWalk(path, { speedMps: () => 2, paused: () => paused, jitterM: 0, now: () => t })
    const stop = walk.start((f) => fixes.push(f))
    for (let i = 0; i < 5; i++) {
      t += 1000
      vi.advanceTimersByTime(1000)
    }
    const along = (f: RawFix) => snapToPath(path, cum, f.lngLat).alongM
    expect(along(fixes.at(-1)!)).toBeCloseTo(10, 0)
    paused = true
    t += 1000
    vi.advanceTimersByTime(1000)
    expect(along(fixes.at(-1)!)).toBeCloseTo(10, 0)
    stop()
    paused = false
    t += 60_000
    walk.start((f) => fixes.push(f))
    expect(along(fixes.at(-1)!)).toBeCloseTo(10, 0)
  })
})
