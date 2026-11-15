import type { NavProgress, RouteStep } from '@/domain'
import { bearingDeg, followingStep, nextStepIndex, stepInstruction } from '@/lib/nav'
import { distanceSpoken } from '@/lib/units'
import type { ActiveTrip } from './activeRoute'

export interface NavModel {
  stepIndex: number
  step: RouteStep | undefined
  /** The step after the next one, for the "Then" preview. */
  then: RouteStep | undefined
  toStepM: number
  remainingM: number
  remainingS: number
  arrived: boolean
}

/** What the banner, trip bar and step list show. Before the first position arrives: the route from its start. */
export function navModel(trip: ActiveTrip, nav: NavProgress | null): NavModel {
  const { steps } = trip.route
  const stepIndex = nav ? nav.stepIndex : nextStepIndex(steps, 0)
  const step = steps[stepIndex]
  return {
    stepIndex,
    step,
    then: nav?.arrived ? undefined : followingStep(steps, stepIndex),
    toStepM: nav ? nav.toStepM : (step?.offsetM ?? trip.route.distanceM),
    remainingM: nav ? nav.remainingM : trip.route.distanceM,
    remainingS: nav ? nav.remainingS : trip.route.durationS,
    arrived: nav?.arrived ?? false,
  }
}

/** The spoken sentence for reaching step `index`. The distance is the leg leading to it, so it changes only with the step. */
export function announcementFor(trip: ActiveTrip, index: number, arrived: boolean): string {
  if (arrived) return `You have arrived at ${trip.destinationName}`
  const { steps } = trip.route
  const step = steps[index]
  if (!step) return ''
  const toStepM = steps[index - 1]?.distanceM ?? step.offsetM
  return `In ${distanceSpoken(toStepM)}, ${instructionFor(trip, step).replace(/^./, (c) => c.toLowerCase())}`
}

/** Instruction text for a step of the active trip. */
export function instructionFor(trip: ActiveTrip, step: RouteStep): string {
  const [a, b] = trip.route.path
  return stepInstruction(step, { destinationName: trip.destinationName, departBearingDeg: a && b ? bearingDeg(a, b) : undefined })
}
