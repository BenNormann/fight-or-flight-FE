import { motion, useReducedMotion } from 'motion/react'
import { Suspense, lazy, useEffect, useRef, type ComponentType, type ReactNode } from 'react'
import { useSession } from '@/api/queries'
import ExploreView from '@/features/explore/ExploreView'
import { useAppStore, type PanelView } from '@/state/store'
import { gateFor } from './authGate'

/** Explore is the first paint; every other view is its own chunk. */
const views: Record<PanelView, ComponentType> = {
  explore: ExploreView,
  search: lazy(() => import('@/features/search/SearchView')),
  place: lazy(() => import('@/features/building/PlaceView')),
  directions: lazy(() => import('@/features/route/DirectionsView')),
  events: lazy(() => import('@/features/events/EventsView')),
  layers: lazy(() => import('@/features/layers/LayersView')),
  safety: lazy(() => import('@/features/safety/SafetyView')),
}

/** Skeleton shaped like a view: header, action row, three list rows. */
function ViewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="motion-safe:opacity-90">
      <div className="h-7 w-2/3 rounded-lg bg-muted" />
      <div className="mt-2 h-4 w-1/2 rounded-lg bg-muted" />
      <div className="mt-4 flex gap-2">
        <div className="h-tap w-32 rounded-full bg-muted" />
        <div className="h-tap w-24 rounded-full bg-muted" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="mt-4 flex items-center gap-3">
          <div className="size-10 rounded-lg bg-muted" />
          <div className="h-4 flex-1 rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  )
}

/** Typing in a field (the search pill opens results live) must never lose focus to a view change. */
function isEditing(el: Element | null) {
  return !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable)
}

/**
 * After a view change, move focus to the new view's heading so keyboard and
 * screen reader users land in it instead of on <body> (the old view unmounted).
 * Waits for lazy views; skips the first render and active text entry.
 */
function useFocusHeadingOnChange(key: string) {
  const ref = useRef<HTMLDivElement | null>(null)
  // Compare keys rather than counting runs, so StrictMode's double effect does not count as a change.
  const shown = useRef(key)
  useEffect(() => {
    if (shown.current === key) return
    shown.current = key
    const root = ref.current
    if (!root || isEditing(document.activeElement)) return
    const focusHeading = () => {
      const h = root.querySelector<HTMLElement>('h1, h2')
      if (!h) return false
      if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1')
      h.focus({ preventScroll: true })
      return true
    }
    if (focusHeading()) return
    const mo = new MutationObserver(() => {
      if (focusHeading()) mo.disconnect()
    })
    mo.observe(root, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [key])
  return ref
}

/** Renders the current view; identical content in the mobile sheet and the desktop panel. */
export function ViewHost({ footer }: { footer?: ReactNode }) {
  const view = useAppStore((s) => s.view)
  const selection = useAppStore((s) => s.selection)
  const reduce = useReducedMotion() ?? false
  // Directions are gated: until the session settles (and while the redirect to sign-in runs), show the
  // skeleton so nothing gated renders or fetches first.
  const { status } = useSession()
  const held = view === 'directions' && gateFor('/route', status) !== 'allow'
  const View = held ? ViewSkeleton : views[view]
  const key = `${view}:${selection?.kind ?? ''}:${selection?.id ?? ''}`
  const ref = useFocusHeadingOnChange(key)

  return (
    <>
      {/* Swap instantly and fade the new view in; no exit wait, so a throttled frame loop never strands a view. */}
      <motion.div
        ref={ref}
        key={key}
        className="[&_h2[tabindex='-1']]:outline-none"
        initial={{ opacity: 0, y: reduce ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Suspense fallback={<ViewSkeleton />}>
          <View />
        </Suspense>
      </motion.div>
      {footer ? <div className="mt-8 flex justify-center">{footer}</div> : null}
    </>
  )
}
