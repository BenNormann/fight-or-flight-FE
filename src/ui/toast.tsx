import { PolishedToaster } from '@/ui/vendor/halo-toast'
import { SHEET_PEEK_PX } from './layout'
import { useBreakpoint } from './media'
import { useTheme } from './theme'

/** FAB 56 + 16 gap, sitting 16 above the sheet peek (app/layouts.tsx). */
const ABOVE_FAB = `calc(var(--safe-bottom) + ${SHEET_PEEK_PX + 16 + 56 + 16}px)`

/**
 * Mount once at the shell root. Toasts sit low, never over the search pill,
 * chips, the active route pill or the map controls:
 * phones above the Directions FAB, tablets above it on the right, desktop bottom
 * centre of the map (the control stack is bottom right).
 */
export default function Toaster() {
  const { resolved } = useTheme()
  const breakpoint = useBreakpoint()
  const tablet = breakpoint === 'tablet'
  const desktop = breakpoint === 'desktop'
  return (
    <PolishedToaster
      theme={resolved}
      visibleToasts={2}
      position={tablet ? 'bottom-right' : 'bottom-center'}
      offset={desktop ? { bottom: 24 } : tablet ? { bottom: 'calc(var(--safe-bottom) + 96px)', right: 16 } : { bottom: ABOVE_FAB }}
      mobileOffset={{ bottom: ABOVE_FAB, left: 16, right: 16 }}
      style={{ zIndex: 'var(--z-toast)' }}
    />
  )
}
