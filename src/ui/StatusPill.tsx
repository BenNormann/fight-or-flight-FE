import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface StatusPillProps {
  icon: ReactNode
  /** Compact line, e.g. "8 min · Hollis Library". */
  summary: ReactNode
  /** Shown when expanded. */
  detail?: ReactNode
  /** Trailing control (End). Always visible. */
  action?: ReactNode
  label: string
}

/**
 * Active state pill (the route "dynamic island"). Tap to expand; the size
 * change is a layout animation (transforms), the showpiece of route mode.
 */
export function StatusPill({ icon, summary, detail, action, label }: StatusPillProps) {
  const [open, setOpen] = useState(false)
  const reduce = useReducedMotion() ?? false
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 36 }

  return (
    <motion.div
      layout
      role="status"
      aria-label={label}
      data-testid="status-pill"
      transition={spring}
      initial={{ opacity: 0, y: reduce ? 0 : -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -16 }}
      style={{ borderRadius: 24 }}
      className="pointer-events-auto w-full max-w-sm overflow-hidden bg-primary text-primary-foreground shadow-overlay"
    >
      <motion.div layout="position" className="flex min-h-14 items-center gap-3 py-2 pr-2 pl-4">
        <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground [&_svg]:size-4">
          {icon}
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="title-3 min-h-tap min-w-0 flex-1 truncate rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
        >
          {summary}
        </button>
        {action}
      </motion.div>
      <AnimatePresence initial={false}>
        {open && detail ? (
          <motion.div
            key="detail"
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn('body-6 px-4 pb-4 text-primary-foreground/80')}
          >
            {detail}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
