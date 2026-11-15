/**
 * Off-route detection for a started trip. Pure: time comes in as an argument.
 *
 * A fix counts as off route when it is farther from the whole route line than
 * `thresholdM` plus half its own accuracy (a vague fix needs to be farther out).
 * The user has left the route only when that holds for `minFixes` fixes in a row
 * spanning at least `confirmMs`, so one bad GPS reading or a quick step around
 * someone never triggers a re-plan. Fixes too vague to judge are skipped
 * without resetting the count. Near the destination, and for `cooldownMs` after
 * a re-plan, nothing triggers.
 */

export interface OffRouteOptions {
  /** Distance from the route line that counts as off it, before the accuracy allowance. */
  thresholdM?: number
  /** How long the user must stay off route. */
  confirmMs?: number
  /** And over how many fixes in a row. */
  minFixes?: number
  /** Fixes vaguer than this are not judged either way. */
  maxAccuracyM?: number
  /** No new re-plan this soon after the last one. */
  cooldownMs?: number
  /** This close to the end (along the route), the user is arriving, not leaving. */
  arrivingM?: number
}

export interface OffRouteState {
  /** Time of the first off-route fix in the current run, or null when on route. */
  since: number | null
  count: number
  /** Time of the last re-plan; -Infinity when none. */
  lastRerouteT: number
}

export const initialOffRoute: OffRouteState = { since: null, count: 0, lastRerouteT: -Infinity }

export interface OffRouteInput {
  /** Distance from the position to the nearest point of the whole route. */
  offRouteM: number
  accuracyM: number
  /** Distance left along the route from that nearest point. */
  remainingM: number
  t: number
}

export const OFF_ROUTE_DEFAULTS: Required<OffRouteOptions> = {
  thresholdM: 30,
  confirmMs: 5_000,
  minFixes: 3,
  maxAccuracyM: 40,
  cooldownMs: 15_000,
  arrivingM: 30,
}

/** Is this fix off route? (Exported for the UI and tests.) */
export const isOffRoute = (offRouteM: number, accuracyM: number, thresholdM = OFF_ROUTE_DEFAULTS.thresholdM) =>
  offRouteM > thresholdM + Math.max(0, accuracyM) / 2

/** Feed one fix; `reroute` is true on the fix that confirms the user left the route. */
export function checkOffRoute(s: OffRouteState, fix: OffRouteInput, opts: OffRouteOptions = {}): { state: OffRouteState; reroute: boolean } {
  const o = { ...OFF_ROUTE_DEFAULTS, ...opts }
  if (!(fix.accuracyM <= o.maxAccuracyM)) return { state: s, reroute: false }
  if (fix.remainingM <= o.arrivingM || !isOffRoute(fix.offRouteM, fix.accuracyM, o.thresholdM)) {
    return { state: s.since === null && s.count === 0 ? s : { ...s, since: null, count: 0 }, reroute: false }
  }
  const since = s.since ?? fix.t
  const count = s.count + 1
  const confirmed = count >= o.minFixes && fix.t - since >= o.confirmMs
  if (confirmed && fix.t - s.lastRerouteT >= o.cooldownMs) {
    return { state: { since: null, count: 0, lastRerouteT: fix.t }, reroute: true }
  }
  return { state: { ...s, since, count }, reroute: false }
}
