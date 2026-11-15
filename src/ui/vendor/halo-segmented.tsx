"use client"

/**
 * Segmented control (single-select toggle group): frosted track, sliding thumb.
 * Project trim (Fight or Flight): the looping hue rim was removed (chrome is
 * monochrome, nothing loops) and the thumb moves via a shared layout element
 * (transform only) instead of animating width. Items are 44px tall.
 */
import { useCallback, useId, useMemo, useState, type ReactNode } from "react"
import { Toggle } from "@base-ui/react/toggle"
import { ToggleGroup } from "@base-ui/react/toggle-group"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/cn"

/** Matches `layoutSpring` in `halo-button-polished.tsx`. */
const layoutSpring = {
  type: "spring" as const,
  bounce: 0,
  damping: 34,
  stiffness: 420,
}

export interface HaloSegmentedItem {
  value: string
  label: ReactNode
  disabled?: boolean
}

export interface HaloSegmentedProps {
  items: HaloSegmentedItem[]
  /** Selected value; omit for uncontrolled usage with `defaultValue`. */
  value?: string
  defaultValue?: string
  onValueChange?: (next: string) => void
  className?: string
  /** Frosted track + backdrop blur (matches card/button translucent mode). */
  translucent?: boolean
  disabled?: boolean
}

export function HaloSegmented({
  items,
  value: valueProp,
  defaultValue,
  onValueChange,
  className,
  translucent = true,
  disabled = false,
  "aria-label": ariaLabel,
}: HaloSegmentedProps & { "aria-label"?: string }) {
  const reduceMotion = useReducedMotion() ?? false
  const thumbId = useId()

  const isControlled = valueProp !== undefined
  const [uncontrolled, setUncontrolled] = useState(
    defaultValue ?? items[0]?.value ?? ""
  )
  const selected = isControlled ? (valueProp ?? "") : uncontrolled

  const setSelected = useCallback(
    (next: string) => {
      if (!isControlled) {
        setUncontrolled(next)
      }
      onValueChange?.(next)
    },
    [isControlled, onValueChange]
  )

  const groupValue = useMemo(() => (selected ? [selected] : []), [selected])

  return (
    <div
      className={cn(
        /* Shadow or border, never both (docs/DESIGN.md §3 elevation). */
        "relative inline-flex max-w-full rounded-full bg-card p-1",
        translucent ? "shadow-float" : "border border-border",
        className
      )}
    >
      <ToggleGroup
        aria-label={ariaLabel}
        className="relative flex min-w-0 gap-0"
        disabled={disabled}
        multiple={false}
        onValueChange={(next) => {
          const first = next[0]
          if (typeof first === "string") {
            setSelected(first)
          }
        }}
        value={groupValue}
      >
        {items.map((item) => (
          <Toggle
            className={cn(
              "relative flex min-h-tap min-w-tap flex-1 items-center justify-center rounded-full px-3",
              "font-medium text-muted-foreground text-sm tracking-tight antialiased",
              "outline-none transition-colors duration-200",
              "focus-visible:outline-2 focus-visible:outline-ring",
              "disabled:pointer-events-none disabled:opacity-50",
              "hover:text-foreground aria-pressed:text-selected-foreground"
            )}
            disabled={item.disabled}
            key={item.value}
            value={item.value}
          >
            {selected === item.value ? (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full bg-selected"
                layoutId={thumbId}
                transition={reduceMotion ? { duration: 0 } : layoutSpring}
              />
            ) : null}
            <span className="relative">{item.label}</span>
          </Toggle>
        ))}
      </ToggleGroup>
    </div>
  )
}
