import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo } from 'react'
import type { Route } from '@/domain'
import { useActiveTrip } from '@/features/route/activeRoute'
import {
  chooseHeading,
  deviceSource,
  ingestFix,
  initialTracker,
  lowPassAngle,
  measure,
  predictAlong,
  progressAt,
  simulatedWalk,
  watchCompass,
  type PositionSource,
  type TrackerOptions,
} from '@/lib/nav'
import { useAppStore } from '@/state/store'
import { notify } from '@/ui'
import { SIM_RATES, useNavDriverSettings } from './navDriverSettings'

/** `setNav` rate while moving. The map interpolates between these; do not publish every frame. */
export const NAV_PUBLISH_MS = 100

/** The route's own average speed (backend distance over duration), at 1×. */
const simSpeed = (route: Route) => route.distanceM / Math.max(1, route.durationS)

/**
 * The one writer of `nav`. While a route is started: takes fixes from the chosen
 * position source and headings from the compass, smooths and predicts them
 * (src/lib/nav/tracker.ts) on an animation frame clock, and publishes about ten
 * times a second. Stops while the page is hidden and once arrived.
 * Reduced motion: no prediction or easing; publishes only when a fix or heading arrives.
 */
export function useNavigationDriver() {
  const trip = useActiveTrip()
  const route = trip?.route
  const sourceId = useNavDriverSettings((s) => s.source)
  const reduce = useReducedMotion() ?? false

  // One simulated walk per route, so switching sources or a hidden page does not restart it.
  const walk = useMemo(() => {
    if (!route) return null
    const speed = simSpeed(route)
    return simulatedWalk(route.path, {
      speedMps: () => speed * useNavDriverSettings.getState().rate,
      paused: () => useNavDriverSettings.getState().paused,
    })
  }, [route])

  useEffect(() => {
    if (!route && useAppStore.getState().nav) useAppStore.getState().setNav(null)
  }, [route])

  useEffect(() => {
    if (!route || !walk) return
    const source: PositionSource = sourceId === 'device' ? deviceSource() : walk
    const cum = measure(route.path)
    // A sped up walk is not an outlier; a real device moving faster than 20 m/s is.
    const maxSpeedMps = sourceId === 'device' ? 20 : Math.max(20, simSpeed(route) * Math.max(...SIM_RATES) * 1.5)
    const opts: TrackerOptions = { path: route.path, cum, predict: !reduce, maxSpeedMps }
    let tracker = initialTracker
    let compass: { deg: number; t: number } | undefined
    let heading: number | undefined
    let lastPublish = -Infinity
    let dirty = false
    let arrived = false
    let raf = 0
    let stopSource: (() => void) | null = null
    let stopCompass: (() => void) | null = null

    const publish = (now: number) => {
      if (tracker.fixes === 0) return
      const p = progressAt(route, cum, predictAlong(tracker, now, opts))
      const target = chooseHeading({ compass, courseDeg: tracker.courseDeg, speedMps: tracker.speedMps, routeBearingDeg: p.headingDeg, now })
      heading = heading === undefined || reduce ? target : lowPassAngle(heading, target, (now - lastPublish) / 1000)
      lastPublish = now
      dirty = false
      useAppStore.getState().setNav({ ...p, headingDeg: heading })
      if (p.arrived) {
        arrived = true
        stop()
      }
    }

    const due = (now: number, gapMs: number) => (reduce ? dirty : now - lastPublish >= gapMs)
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (due(now, NAV_PUBLISH_MS)) publish(now)
    }
    // Some embedded views throttle animation frames while visible; keep progress moving at a lower rate.
    let watchdog = 0
    const nudge = () => {
      const now = performance.now()
      if (due(now, NAV_PUBLISH_MS * 3)) publish(now)
    }

    const start = () => {
      if (arrived || stopSource || document.visibilityState === 'hidden') return
      stopSource = source.start(
        (fix) => {
          tracker = ingestFix(tracker, fix, opts).state
          dirty = true
        },
        (message) => notify({ id: 'nav-location', title: message, description: 'Switch back to the simulated walk to keep going.' }),
      )
      stopCompass = watchCompass((deg, t) => {
        compass = { deg, t }
        dirty = true
      })
      raf = requestAnimationFrame(frame)
      watchdog = window.setInterval(nudge, NAV_PUBLISH_MS * 3)
    }

    function stop() {
      cancelAnimationFrame(raf)
      clearInterval(watchdog)
      stopSource?.()
      stopCompass?.()
      stopSource = null
      stopCompass = null
    }

    const onVisibility = () => (document.visibilityState === 'hidden' ? stop() : start())
    document.addEventListener('visibilitychange', onVisibility)
    start()
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stop()
    }
  }, [route, walk, sourceId, reduce])
}
