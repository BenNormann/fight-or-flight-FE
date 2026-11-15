import { FlagCheckeredIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { distanceText } from '@/lib/units'
import { useAppStore } from '@/state/store'
import { Keystone } from '@/ui'
import { useActiveTrip } from './activeRoute'
import { ManeuverIcon } from './ManeuverIcon'
import { instructionFor, navModel } from './navModel'

const swap = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const } }

/**
 * Next maneuver while navigating: the brand surface of route mode. Cardinal
 * fill, gold arrow, the keystone. Phone: replaces the search pill at the top;
 * desktop: top left over the map. Hidden when the route has no steps.
 * Screen readers get each new maneuver from `NavAnnouncer`, not from here.
 */
export default function ManeuverBanner() {
  const trip = useActiveTrip()
  const nav = useAppStore((s) => s.nav)
  if (!trip || trip.route.steps.length === 0) return null
  const m = navModel(trip, nav)
  const step = m.step

  return (
    <section
      aria-label="Next maneuver"
      data-testid="maneuver-banner"
      className="pointer-events-auto relative w-full overflow-hidden rounded-2xl bg-brand text-brand-foreground shadow-brand"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={m.arrived ? 'arrived' : m.stepIndex} {...swap}>
          <div className="flex items-center gap-3 p-3 pr-6">
            <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-xl bg-brand-pressed text-brand-accent">
              {m.arrived || !step ? <FlagCheckeredIcon className="size-8" /> : <ManeuverIcon maneuver={step.maneuver} className="size-8" />}
            </span>
            <div className="min-w-0 flex-1">
              {m.arrived ? (
                <>
                  <p className="heading-6">You have arrived</p>
                  <p className="body-6 truncate text-brand-foreground/85">{trip.destinationName}</p>
                </>
              ) : step ? (
                <>
                  <p className="heading-5" data-testid="maneuver-distance">
                    <span className="title-3">In </span>
                    <span className="font-mono">{distanceText(m.toStepM)}</span>
                  </p>
                  <p className="title-3 line-clamp-2" data-testid="maneuver-instruction">
                    {instructionFor(trip, step)}
                  </p>
                </>
              ) : null}
            </div>
          </div>
          {m.then ? (
            <div className="caption-4 flex min-h-9 items-center gap-2 bg-brand-pressed px-4 py-2">
              <span className="text-brand-foreground/85">Then</span>
              <ManeuverIcon maneuver={m.then.maneuver} className="size-4 shrink-0 text-brand-accent" />
              <span className="truncate">{instructionFor(trip, m.then)}</span>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
      <Keystone className="top-2 right-2" />
    </section>
  )
}
