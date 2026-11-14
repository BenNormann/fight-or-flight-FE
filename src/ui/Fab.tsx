import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/vendor/button'

type Tone = 'glass' | 'destructive'
type Size = 'fab' | 'tap'

export interface FabProps extends Omit<ComponentProps<'button'>, 'children'> {
  /** Accessible name. Always required: icon-only controls need one. */
  label: string
  icon: ReactNode
  /** Visible text next to the icon. Use for anything that must not rely on an icon alone. */
  text?: string
  tone?: Tone
  /** `fab` 56px, `tap` 44px. */
  size?: Size
  pressed?: boolean
}

const tones: Record<Tone, string> = {
  glass: 'border border-border bg-glass text-foreground backdrop-blur-glass hover:bg-glass',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive dark:bg-destructive',
}

/** Floating action button over the map. Press scale only; never pulses. */
export function Fab({ label, icon, text, tone = 'glass', size = 'fab', pressed, className, ...props }: FabProps) {
  return (
    <Button
      type="button"
      size={null}
      aria-label={text ? undefined : label}
      aria-pressed={pressed}
      title={label}
      className={cn(
        'pointer-events-auto rounded-full shadow-float transition-[transform,background-color] duration-200 active:scale-[0.98]',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        '[&_svg:not([class*=size-])]:size-5',
        size === 'fab' ? 'h-fab min-w-fab' : 'h-tap min-w-tap',
        text ? 'gap-2 px-5 text-base font-semibold' : 'p-0',
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {text ? <span>{text}</span> : null}
    </Button>
  )
}
