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
