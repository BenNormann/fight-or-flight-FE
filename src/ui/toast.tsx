import { PolishedToaster } from '@/ui/vendor/halo-toast'
import { useTheme } from './theme'

/** Mount once at the shell root. Sits below the search bar, above the map chrome. */
export function Toaster() {
  const { resolved } = useTheme()
  return (
    <PolishedToaster
      theme={resolved}
      visibleToasts={2}
      offset={{ top: 'calc(var(--safe-top) + 72px)' }}
      mobileOffset={{ top: 'calc(var(--safe-top) + 72px)', left: 16, right: 16 }}
      style={{ zIndex: 'var(--z-toast)' }}
    />
  )
}
