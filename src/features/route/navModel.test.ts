import { describe, expect, it } from 'vitest'
import { demoRoutes } from '@/demo'
import type { NavProgress } from '@/domain'
import { announcementFor, instructionFor, navModel } from './navModel'

const route = demoRoutes('b-eng', 'walk').find((r) => r.kind === 'safest')!
const trip = { route, destinationName: 'Ronald Tutor Hall' }

describe('navModel', () => {
  it('before the first position, shows the first turn from the start of the route', () => {
    const m = navModel(trip, null)
    expect(m).toMatchObject({ stepIndex: 1, toStepM: route.steps[1]!.offsetM, remainingM: route.distanceM, arrived: false })
    expect(m.then?.maneuver).toBe('right')
  })

  it('drops the preview on arrival and announces it', () => {
    const nav: NavProgress = { position: route.path.at(-1)!, headingDeg: 0, progressM: route.distanceM, stepIndex: 3, toStepM: 0, remainingM: 0, remainingS: 0, arrived: true }
    expect(navModel(trip, nav).then).toBeUndefined()
    expect(announcementFor(trip, 3, true)).toBe('You have arrived at Ronald Tutor Hall')
  })

  it('speaks the leg leading to a maneuver, lower case after the distance', () => {
    expect(instructionFor(trip, route.steps[0]!)).toBe('Head north on Trousdale Pkwy')
    expect(announcementFor(trip, 1, false)).toMatch(/^In [\d.]+ (feet|miles?), turn left onto Childs Way$/)
  })
})
