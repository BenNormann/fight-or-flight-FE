/*
 * Watermelon `scroll-fade`, adapted (docs/COMPONENTS.md):
 * the solid `var(--background)` overlays are replaced by a `mask-image` on the
 * scroller itself (`mask-fade-x` from tokens.css), so the fade works over a
 * live map. Each edge fades only while there is content hidden behind it, so a
 * row at rest (or one that fits) is never faded. Horizontal only.
 *
 * Project additions for mouse users (touch keeps native scrolling):
 * - click and drag scrolls, past a small threshold, and the click that ends a
 *   drag is swallowed so it never presses a chip;
 * - a vertical wheel scrolls the row sideways while it overflows (shift-wheel and
 *   horizontal trackpad deltas are native already).
 * The fade follows because both go through `scrollLeft` and the scroll event.
 */
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '@/lib/cn'

/** Pixels a mouse must move before a press becomes a drag. */
export const DRAG_THRESHOLD_PX = 5

export interface ScrollFadeProps extends ComponentProps<'div'> {
  hideScrollbar?: boolean
}

export function ScrollFade({ children, className, style, hideScrollbar = true, onPointerDown, ...props }: ScrollFadeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ id: number; x: number; left: number; moved: boolean } | null>(null)

  const checkScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setShowLeft(scrollLeft > 0)
    setShowRight(Math.ceil(scrollLeft + clientWidth) < Math.floor(scrollWidth - 1))
  }, [])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    checkScroll()
    // Chip widths change once Geist loads; measure again then.
    void document.fonts?.ready.then(checkScroll)
    container.addEventListener('scroll', checkScroll, { passive: true })
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(checkScroll)
    ro?.observe(container)
    for (const child of Array.from(container.children)) ro?.observe(child)

    // Non-passive so a vertical wheel over an overflowing row scrolls it instead of the page.
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const max = container.scrollWidth - container.clientWidth
      if (max <= 1) return
      const next = Math.min(max, Math.max(0, container.scrollLeft + e.deltaY))
      if (next === container.scrollLeft) return
      e.preventDefault()
      container.scrollLeft = next
    }
    container.addEventListener('wheel', onWheel, { passive: false })

    // Swallow the click that ends a drag (capture, so chips never see it).
    const onClickCapture = (e: MouseEvent) => {
      if (drag.current?.moved) {
        e.preventDefault()
        e.stopPropagation()
      }
      drag.current = null
    }
    container.addEventListener('click', onClickCapture, true)

    return () => {
      container.removeEventListener('scroll', checkScroll)
      container.removeEventListener('wheel', onWheel)
      container.removeEventListener('click', onClickCapture, true)
      ro?.disconnect()
    }
  }, [checkScroll, children])

  const onPointerDownDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    onPointerDown?.(e)
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    drag.current = { id: e.pointerId, x: e.clientX, left: e.currentTarget.scrollLeft, moved: false }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    if (!d.moved) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
      d.moved = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    e.currentTarget.scrollLeft = d.left - dx
  }
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
    // A drag keeps `moved` until the click it produces is swallowed; a plain press clears now.
    if (!d.moved) drag.current = null
  }

  const fade = {
    '--fade-start': showLeft ? undefined : '0px',
    '--fade-end': showRight ? undefined : '0px',
  } as CSSProperties

  return (
    <div
      ref={containerRef}
      data-fade-start={showLeft || undefined}
      data-fade-end={showRight || undefined}
      data-dragging={dragging || undefined}
      className={cn(
        'overflow-x-auto overflow-y-hidden',
        (showLeft || showRight) && 'mask-fade-x',
        dragging && 'cursor-grabbing select-none [&_*]:cursor-grabbing',
        hideScrollbar && '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      style={{ ...fade, ...style }}
      onPointerDown={onPointerDownDrag}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      {...props}
    >
      {children}
    </div>
  )
}
