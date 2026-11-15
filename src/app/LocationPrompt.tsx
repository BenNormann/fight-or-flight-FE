import { CrosshairIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { initLocation, requestLocation, useUserLocation } from '@/lib/geo/location'
import { recenter } from '@/map/controller'
import { useAppStore } from '@/state/store'
import { Button, SHEET_PEEK_PX, useBreakpoint } from '@/ui'

const DISMISSED_KEY = 'odyssey.locationPrompt'

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'dismissed'
  } catch {
    return false
  }
}

/**
 * Our own ask before the browser's. Shown once, on phone and desktop, while the browser
 * has not been asked yet: it says what location is for, and "Allow" is the user gesture
 * the browser prompt needs. Already allowed: nothing shows and the dot just appears.
 * "Not now" is remembered; the locate button and directions can still ask later.
 */
export function LocationPrompt() {
  const { status, asking } = useUserLocation()
  const [dismissed, setDismissed] = useState(wasDismissed)
  const view = useAppStore((s) => s.view)
  const snap = useAppStore((s) => s.sheetSnap)
  const desktop = useBreakpoint() === 'desktop'
  const reduce = useReducedMotion() ?? false

  useEffect(() => {
    void initLocation()
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISSED_KEY, 'dismissed')
    } catch {
      /* Private mode: it will ask again next visit. */
    }
  }

  // Phone: only over the resting map, where it covers nothing the user is doing.
  const show = status === 'prompt' && !dismissed && view === 'explore' && (desktop || snap === 'peek')

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          role="region"
          aria-label="Location access"
          data-testid="location-prompt"
          className="pointer-events-auto absolute z-(--z-chrome) rounded-2xl border border-border bg-card p-4 shadow-float max-md:inset-x-4 md:right-24 md:w-90"
          style={desktop ? { bottom: 24 } : { bottom: `calc(var(--safe-bottom) + ${SHEET_PEEK_PX + 16}px)` }}
          initial={{ opacity: 0, y: reduce ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : 12 }}
          transition={{ duration: reduce ? 0.2 : 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent" aria-hidden>
              <CrosshairIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="title-3">See where you are</p>
              <p className="body-6 mt-1 text-muted-foreground">
                Odyssey uses your location to show you on the map and to start directions from where you stand. It stays on this device unless you turn on sharing.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={dismiss}>
              Not now
            </Button>
            <Button
              tone="brand"
              className="flex-1"
              disabled={asking}
              data-testid="location-allow"
              onClick={() => void requestLocation().then((fix) => fix && recenter())}
            >
              {asking ? 'Waiting…' : 'Allow location'}
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
