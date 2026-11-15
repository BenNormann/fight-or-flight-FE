/*
 * Watermelon `scroll-fade`, adapted (docs/COMPONENTS.md):
 * the solid `var(--background)` overlays are replaced by a `mask-image` on the
 * scroller itself (`mask-fade-x` from tokens.css), so the fade works over a
 * live map. Each edge fades only while there is content hidden behind it, so a
 * row at rest (or one that fits) is never faded. Horizontal only.
 */
import { useCallback, useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties } from 'react'
import { cn } from '@/lib/cn'

export interface ScrollFadeProps extends ComponentProps<'div'> {
  hideScrollbar?: boolean
}

export function ScrollFade({ children, className, style, hideScrollbar = true, ...props }: ScrollFadeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)

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
    const raf = requestAnimationFrame(checkScroll)
    return () => {
      container.removeEventListener('scroll', checkScroll)
      ro?.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [checkScroll, children])

  const fade = {
    '--fade-start': showLeft ? undefined : '0px',
    '--fade-end': showRight ? undefined : '0px',
  } as CSSProperties

  return (
    <div
      ref={containerRef}
      data-fade-start={showLeft || undefined}
      data-fade-end={showRight || undefined}
      className={cn(
        'overflow-x-auto overflow-y-hidden',
        (showLeft || showRight) && 'mask-fade-x',
        hideScrollbar && '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      style={{ ...fade, ...style }}
      {...props}
    >
      {children}
    </div>
  )
}
