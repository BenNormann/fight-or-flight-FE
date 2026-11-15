/**
 * Progress along a started route, from a distance travelled. Pure. Reads the
 * backend's steps and duration; never plans or re-plans a route.
 */
import type { NavProgress, Route, RouteStep } from '@/domain'
import { pointAlong } from './geo'

/** Within this of the end counts as arrived. */
export const ARRIVE_RADIUS_M = 12
/** A maneuver this close behind counts as passed, so the banner moves on as you make the turn. */
export const PASSED_STEP_M = 3

/** Index of the next maneuver ahead of `progressM`: the first step not yet passed, never the departure. */
export function nextStepIndex(steps: RouteStep[], progressM: number): number {
  if (steps.length === 0) return 0
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]!
    if (s.maneuver === 'depart') continue
    if (s.offsetM > progressM + PASSED_STEP_M) return i
  }
  return steps.length - 1
}

/** The step after `index`, for the "Then" preview. */
export function followingStep(steps: RouteStep[], index: number): RouteStep | undefined {
  return steps[index + 1]
}

/**
 * NavProgress for being `progressM` along the route. `cum` is `measure(route.path)`.
 * Remaining time scales the route's own duration by the distance left.
 */
export function progressAt(route: Route, cum: number[], progressM: number, headingDeg?: number): NavProgress {
  const total = cum[cum.length - 1] ?? 0
  const along = Math.min(Math.max(progressM, 0), total)
  const { point, bearingDeg } = pointAlong(route.path, cum, along)
  const remainingM = Math.max(0, total - along)
  const arrived = remainingM <= ARRIVE_RADIUS_M
  const stepIndex = arrived && route.steps.length ? route.steps.length - 1 : nextStepIndex(route.steps, along)
  const step = route.steps[stepIndex]
  return {
    position: point,
    headingDeg: headingDeg ?? bearingDeg,
    progressM: along,
    stepIndex,
    toStepM: step ? Math.max(0, step.offsetM - along) : remainingM,
    remainingM: arrived ? 0 : remainingM,
    remainingS: arrived || total === 0 ? 0 : Math.round((route.durationS * remainingM) / total),
    arrived,
  }
}
