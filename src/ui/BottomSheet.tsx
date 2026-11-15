import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { SheetSnap } from '@/domain'
import { cn } from '@/lib/cn'
import { SHEET_PEEK_PX } from './layout'
import { dragOwner, releaseSnap, rubberBand, snapOffsets, type DragOwner, type SnapOffsets } from './sheetDrag'

/** The drag header: full width, one tap target tall. */
const HEADER_PX = 44
/** Movement before a touch is read as a drag (and stops being a tap). */
const SLOP_PX = 6
const EASE_SETTLE = [0.22, 1, 0.36, 1] as const
const NEXT: Record<SheetSnap, SheetSnap> = { peek: 'half', half: 'full', full: 'peek' }

/** Reads `env(safe-area-inset-bottom)` in px. */
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

/** The sheet's own height (100dvh), tracked as the browser chrome and rotation change it. */
function useHeight(ref: React.RefObject<HTMLElement | null>) {
  const [h, setH] = useState(() => (typeof window === 'undefined' ? 800 : window.innerHeight))
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setH(el.clientHeight || window.innerHeight)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return h
}

export interface BottomSheetProps {
  snap: SheetSnap
  onSnapChange: (snap: SheetSnap) => void
  /** Accessible name for the sheet. The view inside renders its own visible heading. */
  title: string
  children?: ReactNode
  /** Tablet: a floating card on the left instead of edge to edge. */
  floating?: boolean
}

interface Gesture {
  x0: number
  y0: number
  sheetY0: number
  onHeader: boolean
  owner: DragOwner | null
  samples: { t: number; y: number }[]
}

/**
 * The one non-modal sheet over the map (phones and tablets): peek / half / full.
 * The map stays interactive around it. Google Maps drag rules (see `dragOwner`):
 * at peek and half a drag anywhere moves the sheet and the content does not
 * scroll; at full the content scrolls and a downward drag from its top lowers
 * the sheet. The visible body is always sized to the visible part of the sheet,
 * so a view's sticky footer (e.g. directions Start) sits on screen at every snap.
 */
export default function BottomSheet({ snap, onSnapChange, title, children, floating }: BottomSheetProps) {
  const reduce = useReducedMotion() ?? false
  const sheetRef = useRef<HTMLElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const height = useHeight(sheetRef)
  const safeBottom = useSafeBottom()
  const offsets = snapOffsets(height, SHEET_PEEK_PX + safeBottom)
  const y = useMotionValue(offsets[snap])
  const bodyHeight = useTransform(y, (v) => Math.max(0, height - v - HEADER_PX))

  // Latest values for the native listeners, which are installed once.
  const live = useRef({ snap, offsets, onSnapChange, reduce })
  useEffect(() => {
    live.current = { snap, offsets, onSnapChange, reduce }
  })

  const settle = useCallback(
    (to: SheetSnap, o: SnapOffsets = live.current.offsets) => {
      animate(y, o[to], live.current.reduce ? { duration: 0 } : { duration: 0.5, ease: EASE_SETTLE })
    },
    [y],
  )

  // Snap from the store (a selection, a view change) or a new size: move there.
  const placed = useRef(false)
  useLayoutEffect(() => {
    if (!placed.current) {
      placed.current = true
      y.set(offsets[snap])
      return
    }
    settle(snap, offsets)
  }, [snap, offsets.half, offsets.peek, settle, y]) // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving full: start the next visit to full at the top.
  useEffect(() => {
    if (snap !== 'full' && bodyRef.current) bodyRef.current.scrollTop = 0
  }, [snap])

  const release = useCallback(
    (g: Gesture) => {
      const s = g.samples
      const a = s[0]
      const b = s[s.length - 1]
      // A finger that stopped before lifting is not a flick.
      const fresh = !!b && performance.now() - b.t < 80
      const velocity = fresh && a && b && b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0
      const { snap: from, offsets: o, onSnapChange: change } = live.current
      const to = releaseSnap(from, y.get(), velocity, o)
      if (to === from) settle(to)
      else change(to)
    },
    [settle, y],
  )

  const move = useCallback(
    (g: Gesture, clientY: number) => {
      const next = rubberBand(g.sheetY0 + (clientY - g.y0), live.current.offsets)
      y.set(next)
      const t = performance.now()
      g.samples.push({ t, y: next })
      while (g.samples.length > 2 && t - (g.samples[0]?.t ?? t) > 100) g.samples.shift()
    },
    [y],
  )

  // Touch: native listeners so a move can be cancelled before the browser scrolls.
  useEffect(() => {
    const el = sheetRef.current
    if (!el) return
    let g: Gesture | null = null
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!t || e.touches.length !== 1) {
        g = null
        return
      }
      y.stop()
      g = {
        x0: t.clientX,
        y0: t.clientY,
        sheetY0: y.get(),
        onHeader: !!(e.target instanceof Element && e.target.closest('[data-sheet-header]')),
        owner: null,
        samples: [],
      }
    }
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (!g || !t) return
      const dx = t.clientX - g.x0
      const dy = t.clientY - g.y0
      if (g.owner === null) {
        const body = bodyRef.current
        const scrollTop = body?.scrollTop ?? 0
        const atFull = live.current.snap === 'full' && !g.onHeader
        // At full the browser scrolls from the first move, so decide on it; elsewhere wait out the slop.
        if (!atFull && Math.hypot(dx, dy) < SLOP_PX) return
        if (atFull && dx === 0 && dy === 0) return
        g.owner = dragOwner({ snap: live.current.snap, onHeader: g.onHeader, scrollTop, dx, dy })
        if (g.owner === 'sheet') {
          // Start from the finger's current spot so the sheet does not jump by the slop.
          g.y0 = t.clientY
          g.sheetY0 = y.get()
        }
      }
      if (g.owner !== 'sheet') return
      if (e.cancelable) e.preventDefault()
      move(g, t.clientY)
    }
    const onEnd = (e: TouchEvent) => {
      if (!g) return
      const done = g
      g = null
      if (done.owner !== 'sheet') return
      // A drag is not a tap: no click on whatever the finger lifted over.
      if (e.cancelable) e.preventDefault()
      release(done)
    }
    const opts = { passive: false } as const
    el.addEventListener('touchstart', onStart, opts)
    el.addEventListener('touchmove', onMove, opts)
    el.addEventListener('touchend', onEnd, opts)
    el.addEventListener('touchcancel', onEnd, opts)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [move, release, y])

  // Mouse and pen: drag by the header (a tap on it steps through the snaps).
  const mouse = useRef<Gesture | null>(null)
  const dragged = useRef(false)
  const header = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      y.stop()
      dragged.current = false
      mouse.current = { x0: e.clientX, y0: e.clientY, sheetY0: y.get(), onHeader: true, owner: null, samples: [] }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = mouse.current
      if (!g) return
      if (!dragged.current && Math.abs(e.clientY - g.y0) < SLOP_PX) return
      dragged.current = true
      move(g, e.clientY)
    },
    onPointerUp: () => {
      const g = mouse.current
      mouse.current = null
      if (g && dragged.current) release(g)
    },
    onClick: () => {
      if (dragged.current) {
        dragged.current = false
        return
      }
      onSnapChange(NEXT[snap])
    },
  }

  return (
    <motion.section
      ref={sheetRef}
      aria-label={title}
      data-testid="bottom-sheet"
      data-snap={snap}
      style={{ y }}
      className={cn(
        'fixed bottom-0 z-(--z-sheet) flex h-dvh flex-col outline-none',
        'rounded-t-3xl bg-card text-card-foreground shadow-sheet',
        // At peek and half vertical drags are ours; sideways ones still scroll chip rows.
        snap === 'full' ? 'touch-auto' : 'touch-pan-x',
        floating ? 'left-4 w-100' : 'inset-x-0 w-full',
      )}
    >
      <button
        type="button"
        data-sheet-header=""
        aria-label={snap === 'full' ? 'Collapse sheet' : 'Expand sheet'}
        className="flex h-11 w-full shrink-0 cursor-grab touch-none justify-center rounded-t-3xl pt-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:cursor-grabbing"
        {...header}
      >
        {/* Grabber 4×32 in muted-foreground. */}
        <span aria-hidden className="h-1 w-8 rounded-full bg-muted-foreground" />
      </button>
      <motion.div
        ref={bodyRef}
        data-testid="bottom-sheet-body"
        className={cn('min-h-0 px-gutter', snap === 'full' ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden')}
        style={{ height: bodyHeight }}
      >
        <div style={{ paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}>{children}</div>
      </motion.div>
    </motion.section>
  )
}
