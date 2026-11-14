import { useLayoutEffect, useState, type ReactNode } from 'react'
import type { SheetSnap } from '@/domain'
import { cn } from '@/lib/cn'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/ui/vendor/drawer'

/** Collapsed height above the home indicator, matching `--spacing-sheet-peek`. */
export const SHEET_PEEK_PX = 96
const HALF = 0.5
const FULL = 1

/** Reads `env(safe-area-inset-bottom)` in px (vaul snap points need numbers or px strings). */
function useSafeBottom() {
  const [px, setPx] = useState(0)
  useLayoutEffect(() => {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;height:var(--safe-bottom)'
    document.body.appendChild(probe)
    const read = () => setPx(probe.getBoundingClientRect().height)
    read()
    window.addEventListener('resize', read)
    return () => {
      window.removeEventListener('resize', read)
      probe.remove()
    }
  }, [])
  return px
}

export interface BottomSheetProps {
  snap: SheetSnap
  onSnapChange: (snap: SheetSnap) => void
  /** Accessible title; also shown unless `header` replaces it. */
  title: string
  description?: string
  header?: ReactNode
  children?: ReactNode
}

/**
 * The one non-modal sheet over the map: peek / half / full. The map stays
 * interactive behind it. Vaul owns drag physics; the store owns the snap.
 */
export function BottomSheet({ snap, onSnapChange, title, description, header, children }: BottomSheetProps) {
  const safeBottom = useSafeBottom()
  const peek = `${SHEET_PEEK_PX + safeBottom}px`
  const points: (string | number)[] = [peek, HALF, FULL]
  const active = snap === 'peek' ? peek : snap === 'half' ? HALF : FULL

  return (
    <Drawer
      open
      modal={false}
      dismissible={false}
      snapPoints={points}
      activeSnapPoint={active}
      setActiveSnapPoint={(p) => onSnapChange(p === FULL ? 'full' : p === HALF ? 'half' : 'peek')}
    >
      <DrawerContent
        overlay={false}
        handle={false}
        data-testid="bottom-sheet"
        data-snap={snap}
        aria-describedby={undefined}
        className={cn(
          'z-(--z-sheet) mx-auto h-full w-full max-w-xl outline-none',
          'data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-full',
          'data-[vaul-drawer-direction=bottom]:rounded-t-3xl data-[vaul-drawer-direction=bottom]:border-x data-[vaul-drawer-direction=bottom]:border-t',
          'border-border bg-card text-card-foreground shadow-sheet',
        )}
      >
        <button
          type="button"
          aria-label={snap === 'peek' ? 'Expand sheet' : 'Collapse sheet'}
          onClick={() => onSnapChange(snap === 'peek' ? 'half' : 'peek')}
          className="mx-auto flex h-6 w-24 shrink-0 cursor-grab items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-input/60" />
        </button>
        {header ?? (
          <div className="px-gutter pb-3">
            <DrawerTitle className="text-xl font-semibold tracking-tight">{title}</DrawerTitle>
            {description ? <DrawerDescription className="mt-0.5">{description}</DrawerDescription> : null}
          </div>
        )}
        {header ? <DrawerTitle className="sr-only">{title}</DrawerTitle> : null}
        <div
          className={cn(
            'min-h-0 flex-1 px-gutter',
            snap === 'full' ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden',
          )}
          style={{ paddingBottom: 'calc(var(--safe-bottom) + 96px)' }}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
