import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo } from 'react'
import type { Route } from '@/domain'
import { useActiveTrip } from '@/features/route/activeRoute'
import { demoMode } from '@/lib/demoMode'
import { setDemoPosition } from '@/lib/geo/location'
import {
  checkOffRoute,
  chooseHeading,
  deviceSource,
  ingestFix,
  initialOffRoute,
  initialTracker,
  lowPassAngle,
  measure,
  predictAlong,
  progressAt,
  simulatedWalk,
  snapToPath,
  watchCompass,
  type PositionSource,
  type RawFix,
  type TrackerOptions,
} from '@/lib/nav'
import { useAppStore } from '@/state/store'
import { isRerouting, rerouteFrom } from '@/state/trip'
import { notify } from '@/ui'
import { SIM_RATES, useNavDriverSettings } from './navDriverSettings'

/** `setNav` rate while moving. The map interpolates between these; do not publish every frame. */
export const NAV_PUBLISH_MS = 100

/** When the last re-plan started (performance.now()), across routes: a fresh route must not re-plan again at once. */
let lastRerouteT = -Infinity

/** The route's own average speed (backend distance over duration), at 1×. */
const simSpeed = (route: Route) => route.distanceM / Math.max(1, route.durationS)

/**
 * The one writer of `nav`. While a route is started: takes fixes from the chosen
 * position source and headings from the compass, smooths and predicts them
 * (src/lib/nav/tracker.ts) on an animation frame clock, and publishes about ten
 * times a second. Stops while the page is hidden and once arrived.
 * Reduced motion: no prediction or easing; publishes only when a fix or heading arrives.
 *
 * Rerouting: each accepted fix is also checked against the whole route line
 * (src/lib/nav/offRoute.ts). Once the user has clearly left it, the trip is
 * planned again from where they are (`rerouteFrom`), and the new route
 * restarts this effect. Only for trips that start at "your location".
 */
export function useNavigationDriver() {
  const trip = useActiveTrip()
  const route = trip?.route
  const chosenSource = useNavDriverSettings((s) => s.source)
  // A trip that starts somewhere else is played through: there is no "you" on it to follow.
  // Demo mode walks every trip for you.
  const hasOrigin = useAppStore((s) => s.origin) !== null
  const sourceId = demoMode || hasOrigin ? 'simulated' : chosenSource
  const reduce = useReducedMotion() ?? false

  // One simulated walk per route, so switching sources or a hidden page does not restart it.
  const walk = useMemo(() => {
    if (!route) return null
    const speed = simSpeed(route)
    return simulatedWalk(route.path, {
      speedMps: () => speed * useNavDriverSettings.getState().rate,
      paused: () => useNavDriverSettings.getState().paused,
      sidestepM: () => useNavDriverSettings.getState().sidestepM,
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
    const total = cum[cum.length - 1] ?? 0
    let tracker = initialTracker
    let offRoute = { ...initialOffRoute, lastRerouteT }
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
        // Demo mode: "you" are now where the walk ended, so the next trip starts here.
        const end = route.path[route.path.length - 1]
        if (demoMode && end) setDemoPosition(end)
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
          const ingested = ingestFix(tracker, fix, opts)
          tracker = ingested.state
          dirty = true
          if (ingested.accepted) checkLeftRoute(fix)
        },
        (message) => notify({ id: 'nav-location', title: message, description: 'Check that location is allowed for this site.' }),
      )
      stopCompass = watchCompass((deg, t) => {
        compass = { deg, t }
        dirty = true
      })
      raf = requestAnimationFrame(frame)
      watchdog = window.setInterval(nudge, NAV_PUBLISH_MS * 3)
    }

    function checkLeftRoute(fix: RawFix) {
      if (useAppStore.getState().origin !== null) return
      // Against the whole line, not the window the tracker snaps in: walking back along the route is still on it.
      const snap = snapToPath(opts.path, cum, fix.lngLat)
      const checked = checkOffRoute(offRoute, { offRouteM: snap.offRouteM, accuracyM: fix.accuracyM, remainingM: total - snap.alongM, t: fix.t })
      offRoute = checked.state
      if (!checked.reroute || isRerouting()) return
      const started = rerouteFrom(fix.lngLat, (outcome) => {
        // A simulator told to stray walks the new route (or back on the old one) from here on.
        useNavDriverSettings.getState().setSidestep(0)
        notify(
          outcome.ok
            ? { id: 'nav-reroute', title: 'New route from here', description: 'Follow the updated line on the map.' }
            : { id: 'nav-reroute', title: 'Could not find a new route', description: `${outcome.message} Head back to the route shown.` },
        )
      })
      if (!started) return
      lastRerouteT = fix.t
      notify({ id: 'nav-reroute', title: 'Off route', description: 'Finding a new route from where you are.' })
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
