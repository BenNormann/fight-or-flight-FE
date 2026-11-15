import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { SheetSnap } from '@/domain'
import { cn } from '@/lib/cn'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/ui/vendor/drawer'
import { SHEET_PEEK_PX } from './layout'

const HALF = 0.5
const FULL = 1
/** Grabber row height; the body gets the rest of the visible sheet. */
const GRABBER_PX = 24

/** Visible sheet height per snap. Vaul translates the full-height sheet, so the body must not extend past it. */
const visibleHeight: Record<SheetSnap, string> = {
  peek: `calc(${SHEET_PEEK_PX}px + var(--safe-bottom))`,
  half: `${HALF * 100}dvh`,
  full: '100dvh',
}

/** True while `el`'s content is taller than its box. */
function useOverflows(snap: SheetSnap) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [overflows, setOverflows] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    const ro = new ResizeObserver(check)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    check()
    return () => ro.disconnect()
  }, [snap])
  return [ref, overflows] as const
}

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
/**
 * vaul 1.1 never passes `modal` to the Radix Dialog it renders, so even with
 * `modal={false}` Radix's FocusScope traps focus: once anything in the sheet
 * has had focus, focusing the search pill (or any chrome) is bounced back into
 * the sheet and typing goes nowhere. FocusScope listens on `document`; stop
 * focus events that concern elements outside the sheet at `body`, after React
 * (root and portal listeners) has already handled them.
 */
function useReleaseFocusTrap() {
  useEffect(() => {
    const outside = (n: EventTarget | null) => {
      const sheet = document.querySelector('[data-testid="bottom-sheet"]')
      return !!sheet && n instanceof Node && !sheet.contains(n)
    }
    const onIn = (e: FocusEvent) => {
      if (outside(e.target)) e.stopPropagation()
    }
    const onOut = (e: FocusEvent) => {
      if (e.relatedTarget && outside(e.relatedTarget)) e.stopPropagation()
    }
    document.body.addEventListener('focusin', onIn)
    document.body.addEventListener('focusout', onOut)
    return () => {
      document.body.removeEventListener('focusin', onIn)
      document.body.removeEventListener('focusout', onOut)
    }
  }, [])
}

export default function BottomSheet({ snap, onSnapChange, title, description, children, floating }: BottomSheetProps) {
  useReleaseFocusTrap()
  const safeBottom = useSafeBottom()
  const peek = `${SHEET_PEEK_PX + safeBottom}px`
  const points: (string | number)[] = [peek, HALF, FULL]
  const active = snap === 'peek' ? peek : snap === 'half' ? HALF : FULL
  const [bodyRef, overflows] = useOverflows(snap)

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
          // Vaul animates snaps with an inline transition; reduced motion jumps instead.
          'motion-reduce:transition-none!',
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
          className={cn(
            'relative mx-auto flex h-6 w-24 shrink-0 cursor-grab items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring',
            // 44px hit area without changing the 24px row (the lower half is the 8px gap to the header).
            'after:absolute after:inset-x-0 after:-inset-y-2.5',
          )}
        >
          {/* Grabber 4×32 in muted-foreground. */}
          <span aria-hidden className="h-1 w-8 rounded-full bg-muted-foreground" />
        </button>
        {/*
          Scrolls at every snap, limited to the visible part of the sheet. At half, a
          body with hidden content opts out of vaul's drag so touch scrolls it; the
          grabber still drags. At peek, or when it fits, the body keeps drag-to-expand.
        */}
        <div
          ref={bodyRef}
          data-vaul-no-drag={snap === 'half' && overflows ? '' : undefined}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter"
          style={{ maxHeight: `calc(${visibleHeight[snap]} - ${GRABBER_PX}px)` }}
        >
          <div style={{ paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}>{children}</div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
