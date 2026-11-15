import { describe, expect, it } from 'vitest'
import type { LngLat } from '@/domain'
import { checkOffRoute, fromLocal, initialOffRoute, isOffRoute, measure, simulatedWalk, snapToPath, type OffRouteInput, type OffRouteState, type RawFix } from '.'

const fix = (t: number, offRouteM: number, extra: Partial<OffRouteInput> = {}): OffRouteInput => ({ offRouteM, accuracyM: 5, remainingM: 500, t, ...extra })

/** Feeds fixes, returning the final state and the times at which a reroute fired. */
function run(fixes: OffRouteInput[], s: OffRouteState = initialOffRoute) {
  const fired: number[] = []
  for (const f of fixes) {
    const r = checkOffRoute(s, f)
    s = r.state
    if (r.reroute) fired.push(f.t)
  }
  return { s, fired }
}

describe('off-route detection', () => {
  it('needs distance beyond the threshold plus half the accuracy', () => {
    expect(isOffRoute(20, 5)).toBe(false)
    expect(isOffRoute(35, 5)).toBe(true)
    expect(isOffRoute(35, 20)).toBe(false)
  })

  it('reroutes once the user stays off route for 3 fixes and 5 s', () => {
    const { fired } = run([0, 1, 2, 3, 4, 5, 6].map((s) => fix(s * 1000, 60)))
    expect(fired).toEqual([5000])
  })

  it('ignores a single bad fix or a short step aside', () => {
    expect(run([fix(0, 0), fix(1000, 80), fix(2000, 0), fix(3000, 80), fix(4000, 80), fix(5000, 0), fix(6000, 5)]).fired).toEqual([])
  })

  it('skips vague fixes without resetting the run', () => {
    const fixes = [fix(0, 60), fix(1000, 60), fix(2000, 200, { accuracyM: 120 }), fix(5000, 60)]
    expect(run(fixes).fired).toEqual([5000])
  })

  it('does not reroute while arriving', () => {
    expect(run([0, 1, 2, 3, 4, 5, 6].map((s) => fix(s * 1000, 60, { remainingM: 10 }))).fired).toEqual([])
  })

  it('waits out the cooldown after a reroute', () => {
    const fixes = Array.from({ length: 30 }, (_, i) => fix(i * 1000, 60))
    expect(run(fixes).fired).toEqual([5000, 20_000])
  })
})

describe('simulated walk sidestep', () => {
  it('walks beside the route by the set distance', () => {
    const O: LngLat = [-118.2852, 34.0187]
    const path: LngLat[] = [O, fromLocal(O, 0, 200)]
    const cum = measure(path)
    let side = 0
    let t = 0
    const fixes: RawFix[] = []
    const walk = simulatedWalk(path, { speedMps: () => 2, jitterM: 0, now: () => t, sidestepM: () => side })
    const stop = walk.start((f) => fixes.push(f))
    stop()
    expect(snapToPath(path, cum, fixes.at(-1)!.lngLat).offRouteM).toBeCloseTo(0, 3)
    side = 60
    t = 10_000
    walk.start((f) => fixes.push(f))()
    const last = fixes.at(-1)!
    expect(snapToPath(path, cum, last.lngLat).offRouteM).toBeCloseTo(60, 0)
    // Heading north, right is east.
    expect(last.lngLat[0]).toBeGreaterThan(O[0])
  })
})
