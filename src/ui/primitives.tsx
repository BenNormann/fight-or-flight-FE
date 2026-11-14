import { ArrowLeft, ChevronRight, X } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { riskBand } from '@/lib/risk'
import { Button as VendorButton } from '@/ui/vendor/button'

/*
 * Small shared building blocks for every view. Text uses the named styles from
 * tokens.css (title-3, body-6, caption-4 …). All controls are ≥ 44px tall,
 * have a focus ring and press at scale 0.98.
 */

const focus = 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
const press = 'transition-[transform,background-color,color,border-color] duration-200 active:scale-[0.98]'

type ButtonTone = 'brand' | 'primary' | 'secondary' | 'ghost' | 'destructive'
const buttonTones: Record<ButtonTone, string> = {
  brand: 'bg-brand text-brand-foreground hover:bg-brand/90',
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border border-border bg-secondary text-secondary-foreground hover:bg-accent',
  ghost: 'text-foreground hover:bg-accent',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
}

export interface ButtonProps extends ComponentProps<'button'> {
  tone?: ButtonTone
  icon?: ReactNode
  /** Full width inside its container. */
  block?: boolean
}

/** Text button. 44px tall, 12px horizontal padding. */
export function Button({ tone = 'secondary', icon, block, className, children, ...props }: ButtonProps) {
  return (
    <VendorButton
      type="button"
      size={null}
      variant={null}
      className={cn(
        'button-sm h-tap gap-2 rounded-xl px-3 [&_svg:not([class*=size-])]:size-5',
        focus,
        press,
        buttonTones[tone],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </VendorButton>
  )
}

export interface IconButtonProps extends ComponentProps<'button'> {
  label: string
  icon: ReactNode
  tone?: 'ghost' | 'secondary' | 'glass'
}

/** Round 44px icon-only button with an accessible name. */
export function IconButton({ label, icon, tone = 'ghost', className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid size-tap shrink-0 place-items-center rounded-full [&_svg]:size-5',
        focus,
        press,
        tone === 'ghost' && 'text-foreground hover:bg-accent',
        tone === 'secondary' && 'border border-border bg-secondary text-foreground hover:bg-accent',
        tone === 'glass' && 'pointer-events-auto border border-border bg-glass text-foreground shadow-float backdrop-blur-glass hover:bg-card',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  )
}

export interface ChipProps extends ComponentProps<'button'> {
  icon?: ReactNode
  pressed?: boolean
  /** Over the map: frosted with a float shadow. */
  overMap?: boolean
}

export function Chip({ icon, pressed, overMap, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'button-sm inline-flex h-tap shrink-0 items-center gap-2 rounded-full border px-4 [&_svg]:size-4',
        focus,
        press,
        pressed
          ? 'border-primary bg-primary text-primary-foreground'
          : overMap
            ? 'pointer-events-auto border-border bg-glass text-foreground shadow-float backdrop-blur-glass hover:bg-card'
            : 'border-border bg-secondary text-secondary-foreground hover:bg-accent',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

/** Horizontally scrolling row; bleeds to the screen edge on mobile. */
export function ChipRow({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn('flex gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}
    >
      {children}
    </div>
  )
}

export interface ListRowProps extends Omit<ComponentProps<'button'>, 'title'> {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  chevron?: boolean
}

/** Tappable list row: icon tile, title, subtitle, trailing meta. */
export function ListRow({ icon, title, subtitle, meta, chevron = true, className, ...props }: ListRowProps) {
  return (
    <button
      type="button"
      className={cn(
        '-mx-2 flex min-h-14 w-[calc(100%+16px)] items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-accent',
        focus,
        press,
        className,
      )}
      {...props}
    >
      {icon ? (
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-foreground [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="title-3 block truncate">{title}</span>
        {subtitle ? <span className="body-6 block truncate text-muted-foreground">{subtitle}</span> : null}
      </span>
      {meta ? <span className="caption-4 shrink-0 text-muted-foreground">{meta}</span> : null}
      {chevron ? <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
    </button>
  )
}

export interface ViewHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Small line above the title (category, code). */
  eyebrow?: ReactNode
  onBack?: () => void
  onClose?: () => void
  backLabel?: string
}

/** Header for a sheet / panel view. The title is the view's heading. */
export function ViewHeader({ title, subtitle, eyebrow, onBack, onClose, backLabel = 'Back' }: ViewHeaderProps) {
  return (
    <header className="flex items-start gap-2 pb-4">
      {onBack ? <IconButton className="-ml-3" label={backLabel} icon={<ArrowLeft />} onClick={onBack} /> : null}
      <div className={cn('min-w-0 flex-1', onBack && 'pt-2')}>
        {eyebrow ? <p className="caption-4 text-muted-foreground">{eyebrow}</p> : null}
        <h2 className="heading-6">{title}</h2>
        {subtitle ? <p className="body-6 mt-1 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {onClose ? <IconButton className="-mr-3" label="Close" icon={<X />} onClick={onClose} tone="ghost" /> : null}
    </header>
  )
}

export function Section({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('mt-6 first:mt-0', className)}>
      {title ? (
        <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
          <h3 className="title-4 text-muted-foreground">{title}</h3>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export interface ActionItem {
  id: string
  label: string
  icon: ReactNode
  onClick: () => void
  /** One per row at most: the brand coloured primary action. */
  primary?: boolean
}

/** Google Maps style row of round actions with labels underneath. */
export function ActionBar({ actions, className }: { actions: ActionItem[]; className?: string }) {
  return (
    <div className={cn('-mx-gutter flex gap-2 overflow-x-auto px-gutter [scrollbar-width:none]', className)}>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.onClick}
          className={cn(
            'button-sm inline-flex h-tap shrink-0 items-center gap-2 rounded-full px-4 [&_svg]:size-4',
            focus,
            press,
            a.primary ? 'bg-brand text-brand-foreground hover:bg-brand/90' : 'border border-border bg-secondary hover:bg-accent',
          )}
        >
          {a.icon}
          {a.label}
        </button>
      ))}
    </div>
  )
}

export interface SwitchRowProps {
  label: string
  description?: string
  icon?: ReactNode
  checked: boolean
  onCheckedChange: (on: boolean) => void
}

/** Full-row toggle. The whole row is the 44px+ target. */
export function SwitchRow({ label, description, icon, checked, onCheckedChange }: SwitchRowProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn('-mx-2 flex min-h-14 w-[calc(100%+16px)] items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-accent', focus)}
    >
      {icon ? (
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="title-3 block">{label}</span>
        {description ? <span className="body-6 block text-muted-foreground">{description}</span> : null}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-primary bg-primary' : 'border-input bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-4 rounded-full transition-transform duration-200',
            checked ? 'translate-x-4 bg-primary-foreground' : 'bg-input',
          )}
        />
      </span>
    </button>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-8 text-center">
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">
        {icon}
      </span>
      <p className="title-3 mt-3">{title}</p>
      <p className="body-6 mt-1 max-w-xs text-muted-foreground">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/** Risk label with its colour swatch. Never colour alone. */
export function RiskBadge({ score, prefix }: { score: number; prefix?: string }) {
  const band = riskBand(score)
  return (
    <span className="caption-4 inline-flex items-center gap-2 rounded-full border border-border px-2 py-0.5">
      <span aria-hidden className="size-2 rounded-full" style={{ background: `var(${band.cssVar})` }} />
      {prefix ? `${prefix}: ` : ''}
      {band.label} risk
    </span>
  )
}

/** Card surface used for grouped content inside a view. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-2xl border border-border bg-card p-4', className)} {...props} />
}
