import { Outlet } from 'react-router'
import { useCapabilities } from '@/api/capabilities'
import { useAppConfig } from '@/api/queries'
import { env } from '@/lib/env'
import { MapView } from '@/map/MapView'
import { Toaster, useThemeController } from '@/ui'
import { MapChrome } from './MapChrome'
import { SheetHost } from './SheetHost'

/** The one screen: full-bleed map, floating chrome, one bottom sheet. */
export function Shell() {
  useThemeController()
  const config = useAppConfig()
  const capabilities = useCapabilities()
  const served = Object.values(capabilities).filter(Boolean).length

  const status = (
    <p data-testid="backend-status" className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
      {env.useMocks ? 'Mock backend' : 'Live backend'}
      {' · '}
      {config.isPending ? 'connecting…' : config.isError ? 'unreachable' : `${served} features served`}
    </p>
  )

  return (
    <div data-testid="app-shell" className="relative h-dvh w-full overflow-hidden bg-background">
      <MapView />
      <MapChrome />
      <SheetHost status={status} />
      <Toaster />
      <Outlet />
    </div>
  )
}
