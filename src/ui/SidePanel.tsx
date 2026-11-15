import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { SIDE_PANEL_PX } from './layout'

export interface SidePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pinned above the scrolling body (search). */
  top: ReactNode
  children: ReactNode
  label: string
}

/**
 * Desktop replacement for the bottom sheet: a full-height panel on the left.
 * Collapses by sliding out (transform only); a tab on its edge brings it back.
 */
export function SidePanel({ open, onOpenChange, top, children, label }: SidePanelProps) {
  const reduce = useReducedMotion() ?? false
  return (
    <motion.aside
      aria-label={label}
      data-testid="side-panel"
      data-open={open}
      className="absolute inset-y-0 left-0 z-(--z-sheet) flex"
      style={{ width: SIDE_PANEL_PX }}
      initial={false}
      animate={{ x: open ? 0 : -SIDE_PANEL_PX }}
      transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className="flex h-full w-full flex-col bg-card text-card-foreground shadow-overlay"
        inert={!open}
      >
        <div className="shrink-0 p-4 pb-2">{top}</div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-8">{children}</div>
      </div>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-label={open ? 'Collapse side panel' : 'Expand side panel'}
        aria-expanded={open}
        className={cn(
          'absolute top-1/2 -right-6 grid h-16 w-6 -translate-y-1/2 place-items-center rounded-r-lg bg-card text-muted-foreground shadow-float',
          'outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        {open ? <CaretLeftIcon className="size-4" /> : <CaretRightIcon className="size-4" />}
      </button>
    </motion.aside>
  )
}
