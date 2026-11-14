import { Outlet } from 'react-router'
import { useCapabilities } from '@/api/capabilities'
import { useAppConfig } from '@/api/queries'
import { env } from '@/lib/env'
import { MapView } from '@/map/MapView'
import { Toaster, useBreakpoint, useThemeController } from '@/ui'
import { DesktopLayout, TouchLayout } from './layouts'
import { useStoreToUrl } from './urlSync'

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
    <div data-testid="app-shell" data-layout={breakpoint} className="relative h-dvh w-full overflow-hidden bg-background">
      <MapView />
      {breakpoint === 'desktop' ? <DesktopLayout footer={status} /> : <TouchLayout tablet={breakpoint === 'tablet'} footer={status} />}
      <Toaster />
      <Outlet />
    </div>
  )
}
