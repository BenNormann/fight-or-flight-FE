import { cn } from '@/lib/cn'

/** Shared with the real menu trigger so swapping in the lazy menu is invisible. */
export const menuTriggerClass = cn(
  'pointer-events-auto inline-grid size-tap shrink-0 place-items-center rounded-full transition-transform duration-200 active:scale-[0.98]',
  'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
)
