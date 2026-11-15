/*
 * Cult `halo-switch`, adapted (docs/COMPONENTS.md, docs/DESIGN.md §3 switch row):
 * the frosted shell, underglow and magenta / purple / cyan gradients are removed.
 * Switches live in sheets, so on is neutral `primary`, not brand. Track 40×24, no border, 1px inset `input`
 * ring when off. Thumb 16px, absolutely centred (`top-1/2 -translate-y-1/2`,
 * which uses the CSS `translate` property) and moved 16px by a motion
 * `transform`, so the two never fight. No layout measuring.
 */
import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import { motion, useReducedMotion } from 'motion/react'
import type { ComponentProps, CSSProperties } from 'react'
import { cn } from '@/lib/cn'

/** Track 40 − thumb 16 − 2 × 4 inset. */
const THUMB_TRAVEL_PX = 16
const settle = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const }

export type HaloSwitchProps = SwitchPrimitive.Root.Props

export function HaloSwitch({ className, ...rootProps }: HaloSwitchProps) {
  const reduceMotion = useReducedMotion() ?? false
  return (
    <SwitchPrimitive.Root
      {...rootProps}
      data-slot="halo-switch"
      className={cn(
        'relative inline-block h-6 w-10 shrink-0 cursor-pointer self-center rounded-full outline-none',
        'transition-colors duration-200',
        'data-unchecked:bg-muted data-unchecked:inset-ring data-unchecked:inset-ring-input',
        'data-checked:bg-primary',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        data-slot="halo-switch-thumb"
        render={(thumbProps, thumbState) => {
          const {
            className: thumbClassName,
            style: thumbStyle,
            // DOM handlers that share names with Motion APIs but have incompatible typings.
            onDrag: _onDrag,
            onDragStart: _onDragStart,
            onDragEnd: _onDragEnd,
            onAnimationStart: _onAnimationStart,
            onAnimationEnd: _onAnimationEnd,
            ...thumbRest
          } = thumbProps
          const { transform: _transform, ...thumbStyleSafe } = (thumbStyle ?? {}) as CSSProperties
          return (
            <motion.span
              {...thumbRest}
              initial={false}
              animate={{ x: thumbState.checked ? THUMB_TRAVEL_PX : 0 }}
              transition={reduceMotion ? { duration: 0 } : settle}
              className={cn(
                thumbClassName,
                'pointer-events-none absolute top-1/2 left-1 block size-4 -translate-y-1/2 rounded-full transition-colors duration-200',
                thumbState.checked ? 'bg-primary-foreground' : 'bg-input',
              )}
              style={thumbStyleSafe}
            />
          )
        }}
      />
    </SwitchPrimitive.Root>
  )
}

export type HaloSwitchThumbProps = ComponentProps<typeof SwitchPrimitive.Thumb>
