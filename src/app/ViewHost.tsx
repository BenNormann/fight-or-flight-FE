import { motion, useReducedMotion } from 'motion/react'
import { Suspense, lazy, type ComponentType, type ReactNode } from 'react'
import ExploreView from '@/features/explore/ExploreView'
import { useAppStore, type PanelView } from '@/state/store'

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

/** Renders the current view; identical content in the mobile sheet and the desktop panel. */
export function ViewHost({ footer }: { footer?: ReactNode }) {
  const view = useAppStore((s) => s.view)
  const selection = useAppStore((s) => s.selection)
  const reduce = useReducedMotion() ?? false
  const View = views[view]
  const key = `${view}:${selection?.kind ?? ''}:${selection?.id ?? ''}`

  return (
    <>
      {/* Swap instantly and fade the new view in; no exit wait, so a throttled frame loop never strands a view. */}
      <motion.div
        key={key}
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
