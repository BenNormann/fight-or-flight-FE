import { PolishedToaster } from '@/ui/vendor/halo-toast'
import { useBreakpoint } from './media'
import { useTheme } from './theme'

/**
 * Mount once at the shell root. Phones: below the search pill and chips.
 * Desktop: bottom centre of the map, clear of the chips and the panel.
 */
export function Toaster() {
  const { resolved } = useTheme()
  const desktop = useBreakpoint() === 'desktop'
  return (
    <PolishedToaster
      theme={resolved}
      visibleToasts={2}
      position={desktop ? 'bottom-center' : 'top-center'}
      offset={desktop ? { bottom: 24 } : { top: 'calc(var(--safe-top) + 128px)' }}
      mobileOffset={{ top: 'calc(var(--safe-top) + 128px)', left: 16, right: 16 }}
      style={{ zIndex: 'var(--z-toast)' }}
    />
  )
}
