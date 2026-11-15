import { Component, Suspense, lazy, type CSSProperties, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useCapabilities } from '@/api/capabilities'
import { useAppConfig, useLiveLocation } from '@/api/queries'
import { cn } from '@/lib/cn'
import { env } from '@/lib/env'
import { useAppStore } from '@/state/store'
import { SHEET_PEEK_PX, Toaster, useBreakpoint, useThemeController } from '@/ui'
import { isLoginPath } from './authGate'
import { DesktopLayout, TouchLayout } from './layouts'
import { useStoreToUrl } from './urlSync'

/** Lazy: the map engine and its data load as their own chunk, in parallel with the chrome. */
const MapView = lazy(() => import('@/map/MapView').then((m) => ({ default: m.MapView })))

/** A map that fails to load (offline chunk, engine error) leaves the chrome and sheet usable. */
class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error('Map failed to load', error)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** The one screen: full-bleed map, floating chrome, and a sheet (touch) or side panel (desktop). */
export function Shell() {
  useThemeController()
  useStoreToUrl()
  useLiveLocation(useAppStore((s) => s.liveLocationOptIn))
  const breakpoint = useBreakpoint()
  const config = useAppConfig()
  const capabilities = useCapabilities()
  const served = Object.values(capabilities).filter(Boolean).length
  const snap = useAppStore((s) => s.sheetSnap)
  // Sign-in pages replace the chrome (sheet, panel, controls); the map stays mounted but inert underneath.
  const signingIn = isLoginPath(useLocation().pathname)
  // Map attribution is a licence requirement: keep it on screen and clear of chrome.
  // Phone: bottom left, just above the sheet's top edge (FAB and controls are on the right).
  const attributionBottom = snap === 'half' ? 'calc(50dvh + 8px)' : `calc(var(--safe-bottom) + ${SHEET_PEEK_PX + 8}px)`

  const status = (
    <p data-testid="backend-status" className="caption-5 rounded-full border border-border px-3 py-1 text-muted-foreground">
      {env.useMocks ? 'Mock backend' : 'Live backend'}
      {' · '}
      {config.isPending ? 'connecting…' : config.isError ? 'unreachable' : `${served} features served`}
      {' · Demo campus data'}
    </p>
  )

  return (
    <div data-testid="app-shell" data-layout={breakpoint} className="relative isolate h-dvh w-full overflow-hidden bg-background">
      {/* Chrome first in the DOM so search and the panel come before map pins in tab order; z-index keeps the map underneath. */}
      {signingIn ? null : breakpoint === 'desktop' ? (
        <DesktopLayout footer={status} />
      ) : (
        <TouchLayout tablet={breakpoint === 'tablet'} footer={status} />
      )}
      <div
        className={cn(
          // `!`: MapLibre's stylesheet is unlayered, so it beats Tailwind's utilities layer otherwise.
          'absolute inset-0 -z-10',
          breakpoint === 'mobile'
            ? '[&_.maplibregl-ctrl-bottom-right]:right-auto! [&_.maplibregl-ctrl-bottom-right]:bottom-(--attribution-bottom)! [&_.maplibregl-ctrl-bottom-right]:left-[var(--safe-left)]! [&_.maplibregl-ctrl-attrib]:max-w-[calc(100vw-96px)]!'
            : // Tablet and desktop: bottom right, left of the FAB / control stack (16 or 24 + 44..56px wide).
              '[&_.maplibregl-ctrl-bottom-right]:right-20! [&_.maplibregl-ctrl-bottom-right]:bottom-(--safe-bottom)!',
        )}
        style={{ '--attribution-bottom': attributionBottom } as CSSProperties}
        inert={signingIn}
      >
        <MapBoundary>
          <Suspense fallback={null}>
            <MapView />
          </Suspense>
        </MapBoundary>
      </div>
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
      <Outlet />
    </div>
  )
}
