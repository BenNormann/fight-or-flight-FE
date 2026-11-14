import { Outlet } from 'react-router'
import { useCapabilities } from '@/api/capabilities'
import { useAppConfig } from '@/api/queries'
import { env } from '@/lib/env'
import { MapView } from '@/map/MapView'

/**
 * The one screen: full-bleed map with floating chrome and a bottom sheet.
 * P0 is a blank shell; the shell lane (P1) adds search, sheet, FABs and mode switch.
 */
export function Shell() {
  const config = useAppConfig()
  const capabilities = useCapabilities()
  const served = Object.entries(capabilities).filter(([, on]) => on).map(([key]) => key)

  return (
    <div data-testid="app-shell" className="relative h-dvh w-full overflow-hidden">
      <MapView />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
      >
        <p
          data-testid="backend-status"
          className="rounded-full border border-current/15 px-4 py-2 text-center text-xs opacity-80"
        >
          {env.useMocks ? 'Mock backend' : 'Live backend'}
          {' · '}
          {config.isPending ? 'connecting…' : config.isError ? 'unreachable' : `${served.length} features served`}
        </p>
      </div>
      <Outlet />
    </div>
  )
}
