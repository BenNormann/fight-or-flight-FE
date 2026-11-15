import { useSyncExternalStore } from 'react'

/** < 768 phone, 768–1023 tablet, ≥ 1024 desktop. Mirrors Tailwind `md` and `lg`. */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

export function breakpointFor(width: number): Breakpoint {
  return width >= 1024 ? 'desktop' : width >= 768 ? 'tablet' : 'mobile'
}

function subscribe(cb: () => void) {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}

export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, () => breakpointFor(window.innerWidth), () => 'mobile')
}

export function useViewportHeight(): number {
  return useSyncExternalStore(subscribe, () => window.innerHeight, () => 844)
}

function subscribeVisual(cb: () => void) {
  const vv = window.visualViewport
  if (!vv) return subscribe(cb)
  vv.addEventListener('resize', cb)
  vv.addEventListener('scroll', cb)
  return () => {
    vv.removeEventListener('resize', cb)
    vv.removeEventListener('scroll', cb)
  }
}

const visualSnapshot = () => {
  const vv = window.visualViewport
  return vv ? `${Math.round(vv.offsetTop)} ${Math.round(vv.height)}` : `0 ${window.innerHeight}`
}

/**
 * The part of the screen the user can actually see: the visual viewport, which
 * shrinks when the on-screen keyboard opens. `top` is its offset in the layout
 * viewport, for `position: fixed` surfaces that must sit above the keyboard.
 */
export function useVisualViewport(): { top: number; height: number } {
  const snap = useSyncExternalStore(subscribeVisual, visualSnapshot, () => '0 844')
  const [top = 0, height = 0] = snap.split(' ').map(Number)
  return { top, height }
}
