import { Component, Suspense, lazy, type ReactNode } from 'react'
import { Outlet } from 'react-router'
import { useCapabilities } from '@/api/capabilities'
import { useAppConfig } from '@/api/queries'
import { env } from '@/lib/env'
import { Toaster, useBreakpoint, useThemeController } from '@/ui'
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
  const breakpoint = useBreakpoint()
  const config = useAppConfig()
  const capabilities = useCapabilities()
  const served = Object.values(capabilities).filter(Boolean).length

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
      {breakpoint === 'desktop' ? <DesktopLayout footer={status} /> : <TouchLayout tablet={breakpoint === 'tablet'} footer={status} />}
      <div className="absolute inset-0 -z-10">
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
