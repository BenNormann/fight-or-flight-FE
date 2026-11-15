import { useLayoutEffect, useState, type ReactNode } from 'react'
import type { SheetSnap } from '@/domain'
import { cn } from '@/lib/cn'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/ui/vendor/drawer'
import { SHEET_PEEK_PX } from './layout'

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
  /** Accessible name for the sheet. The view inside renders its own visible heading. */
  title: string
  description?: string
  children?: ReactNode
  /** Tablet: a floating card on the left instead of edge to edge. */
  floating?: boolean
}

/**
 * The one non-modal sheet over the map (mobile and tablet): peek / half / full.
 * The map stays interactive behind it. Vaul owns drag physics; the store owns the snap.
 * Loaded lazily so desktop never downloads vaul.
 */
export default function BottomSheet({ snap, onSnapChange, title, description, children, floating }: BottomSheetProps) {
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
          'z-(--z-sheet) h-full w-full outline-none',
          'data-[vaul-drawer-direction=bottom]:mt-0 data-[vaul-drawer-direction=bottom]:max-h-full',
          // shadow-sheet carries its own 1px casing: no border on top of it (docs/DESIGN.md §3 elevation).
          'data-[vaul-drawer-direction=bottom]:rounded-t-3xl',
          'bg-card text-card-foreground shadow-sheet',
          floating ? 'data-[vaul-drawer-direction=bottom]:left-4 data-[vaul-drawer-direction=bottom]:right-auto md:w-100' : 'mx-auto',
        )}
      >
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        {description ? <DrawerDescription className="sr-only">{description}</DrawerDescription> : null}
        <button
          type="button"
          aria-label={snap === 'full' ? 'Collapse sheet' : 'Expand sheet'}
          onClick={() => onSnapChange(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek')}
          className="mx-auto flex h-6 w-24 shrink-0 cursor-grab items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {/* Grabber 4×32 in muted-foreground; the button's lower half is the 8px gap to the header. */}
          <span aria-hidden className="h-1 w-8 rounded-full bg-muted-foreground" />
        </button>
        <div
          className={cn(
            'min-h-0 flex-1 px-gutter',
            snap === 'full' ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden',
          )}
          style={{ paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
