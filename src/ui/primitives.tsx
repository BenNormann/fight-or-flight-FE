import { ArrowLeftIcon, CaretRightIcon, IconContext, XIcon } from '@phosphor-icons/react'
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { riskBand } from '@/lib/risk'
import { Button as VendorButton } from '@/ui/vendor/button'
import { HaloSwitch } from '@/ui/vendor/halo-switch'
import { ScrollFade } from '@/ui/vendor/scroll-fade'

/*
 * Small shared building blocks for every view (docs/DESIGN.md §3). Text uses the
 * named styles from tokens.css (title-3, body-6, caption-4 …). All controls are
 * ≥ 44px tall, have a focus ring, shift on hover and press at scale 0.98.
 * Icons are Phosphor: Regular at rest, Fill when selected, Duotone in empty states.
 */

const focus = 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
const press = 'transition-[transform,background-color,color,border-color] duration-200 active:scale-[0.98]'
const brandFill = 'relative bg-brand text-brand-foreground hover:bg-brand-hover active:bg-brand-pressed dark:shadow-brand'

/** The signature: a 4px gold dot at the top right of every cardinal fill. Parent must be `relative`. */
export function Keystone({ className }: { className?: string }) {
  return <span aria-hidden data-slot="keystone" className={cn('pointer-events-none absolute top-1.5 right-1.5 size-1 rounded-full bg-gold', className)} />
}

/** Sets the Phosphor weight for every icon passed in as a node. */
function IconWeight({ weight, children }: { weight: 'regular' | 'fill' | 'duotone'; children: ReactNode }) {
  return <IconContext.Provider value={{ weight }}>{children}</IconContext.Provider>
}

type ButtonTone = 'brand' | 'primary' | 'secondary' | 'ghost' | 'destructive'
const buttonTones: Record<ButtonTone, string> = {
  brand: cn('button-md', brandFill),
  primary: 'button-sm bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'button-sm border border-border bg-secondary text-secondary-foreground hover:bg-accent',
  ghost: 'button-sm text-foreground hover:bg-accent',
  destructive: 'button-sm bg-destructive text-destructive-foreground hover:bg-destructive/90',
}

export interface ButtonProps extends ComponentProps<'button'> {
  tone?: ButtonTone
  icon?: ReactNode
  /** Full width inside its container. */
  block?: boolean
}

/** Text button. 44px tall, padding 8 / 12 (16 inline when full width). `brand` is the one main action per view. */
export function Button({ tone = 'secondary', icon, block, className, children, ...props }: ButtonProps) {
  return (
    <VendorButton
      type="button"
      size={null}
      variant={null}
      className={cn(
        'min-h-tap gap-2 rounded-xl px-3 py-2 [&_svg:not([class*=size-])]:size-4',
        focus,
        press,
        buttonTones[tone],
        block && 'w-full px-4',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {tone === 'brand' ? <Keystone /> : null}
    </VendorButton>
  )
}

export interface IconButtonProps extends ComponentProps<'button'> {
  label: string
  icon: ReactNode
  /** `float` is the map control: opaque card with a float shadow. */
  tone?: 'ghost' | 'secondary' | 'float'
}

/** Round 44px icon-only button with an accessible name. With `aria-pressed`, the active glyph turns brand ink. */
export function IconButton({ label, icon, tone = 'ghost', className, ...props }: IconButtonProps) {
  const pressed = props['aria-pressed'] === true || props['aria-pressed'] === 'true'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid size-tap shrink-0 place-items-center rounded-full text-foreground [&_svg]:size-5 aria-pressed:text-brand-ink',
        focus,
        press,
        tone === 'ghost' && 'hover:bg-accent',
        tone === 'secondary' && 'border border-border bg-secondary hover:bg-accent',
        tone === 'float' && 'pointer-events-auto bg-card shadow-float hover:bg-accent',
        className,
      )}
      {...props}
    >
      <IconWeight weight={pressed ? 'fill' : 'regular'}>{icon}</IconWeight>
    </button>
  )
}

export interface ChipProps extends ComponentProps<'button'> {
  icon?: ReactNode
  pressed?: boolean
  /** Over the map: opaque card with `shadow-chip`. Otherwise (in a sheet): secondary fill, no shadow. Pressed: `primary` in both. */
  overMap?: boolean
}

export function Chip({ icon, pressed, overMap, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        'button-sm inline-flex h-tap shrink-0 items-center gap-2 rounded-full px-4 whitespace-nowrap [&_svg]:size-4',
        focus,
        press,
        // Pressed is neutral (inverted foreground) everywhere; brand colour is kept for the one primary action and map selection.
        pressed
          ? cn('bg-primary text-primary-foreground hover:bg-primary/90', overMap && 'pointer-events-auto')
          : overMap
            ? 'pointer-events-auto bg-card text-card-foreground shadow-chip hover:bg-accent'
            : 'bg-secondary text-secondary-foreground hover:bg-accent',
        className,
      )}
      {...props}
    >
      {icon ? <IconWeight weight={pressed ? 'fill' : 'regular'}>{icon}</IconWeight> : null}
      {children}
    </button>
  )
}

export interface ChipRowProps {
  label: string
  className?: string
  children: ReactNode
  /**
   * Bleed to both screen edges (`-mx-gutter`) from inside a gutter-padded parent.
   * Turn off when the parent is already full width.
   */
  bleed?: boolean
}

/**
 * Toolbar keys: ← → move between chips, Home / End jump to the ends. The focused
 * chip scrolls into view (`scroll-px-4` keeps it clear of the edge fade).
 */
function moveFocusInRow(e: KeyboardEvent<HTMLElement>) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(e.key)) return
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])'))
  const i = items.indexOf(document.activeElement as HTMLElement)
  if (i < 0) return
  const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : i + (e.key === 'ArrowRight' ? 1 : -1)
  const target = items[Math.max(0, Math.min(items.length - 1, next))]
  e.preventDefault()
  if (!target) return
  target.focus({ preventScroll: true })
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

/**
 * Horizontally scrolling chip row (docs/DESIGN.md §3 chip row). The scroller is
 * masked with `mask-fade-x` while content hides behind an edge. 8px block padding
 * cancelled by `-my-2` leaves room for `shadow-chip` inside the clip.
 */
export function ChipRow({ label, className, children, bleed = true }: ChipRowProps) {
  return (
    <ScrollFade
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      data-slot="chip-row"
      onKeyDown={moveFocusInRow}
      className={cn(
        'flex gap-2 overscroll-x-contain px-gutter py-2 -my-2 scroll-px-4',
        bleed && '-mx-gutter',
        className,
      )}
    >
      {children}
    </ScrollFade>
  )
}

export interface ListRowProps extends Omit<ComponentProps<'button'>, 'title'> {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  chevron?: boolean
  /** Selected row: neutral `accent` fill and an inverted tile (brand colour stays on the map). */
  selected?: boolean
}

/** Tappable list row: icon tile, title, subtitle, trailing meta. */
export function ListRow({ icon, title, subtitle, meta, chevron = true, selected, className, ...props }: ListRowProps) {
  return (
    <button
      type="button"
      aria-current={selected || undefined}
      className={cn(
        '-mx-2 flex min-h-14 w-[calc(100%+16px)] items-center gap-3 rounded-xl px-2 py-2 text-left',
        selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent',
        focus,
        press,
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          aria-hidden
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-5',
            selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
          )}
        >
          <IconWeight weight={selected ? 'fill' : 'regular'}>{icon}</IconWeight>
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="title-3 block truncate">{title}</span>
        {subtitle ? <span className="body-6 block truncate text-muted-foreground">{subtitle}</span> : null}
      </span>
      {meta ? <span className="caption-4 shrink-0 text-muted-foreground">{meta}</span> : null}
      {chevron ? <CaretRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" /> : null}
    </button>
  )
}

export interface ViewHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Small line above the title (category, code), in brand ink. */
  eyebrow?: ReactNode
  onBack?: () => void
  onClose?: () => void
  backLabel?: string
}

/** Header for a sheet / panel view. The title is the view's heading. No divider; 16px gap below. */
export function ViewHeader({ title, subtitle, eyebrow, onBack, onClose, backLabel = 'Back' }: ViewHeaderProps) {
  return (
    <header className="flex items-start gap-2 pb-4">
      {onBack ? <IconButton className="-ml-3" label={backLabel} icon={<ArrowLeftIcon />} onClick={onBack} /> : null}
      <div className={cn('min-w-0 flex-1', (onBack || onClose) && 'pt-2')}>
        {eyebrow ? <p className="caption-4 text-brand-ink">{eyebrow}</p> : null}
        <h2 className="heading-6">{title}</h2>
        {subtitle ? <p className="body-6 mt-1 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {onClose ? <IconButton className="-mr-3" label="Close" icon={<XIcon />} onClick={onClose} tone="ghost" /> : null}
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

/** Google Maps style row of pill actions; scrolls with the same edge fade as the chip row. */
export function ActionBar({ actions, className }: { actions: ActionItem[]; className?: string }) {
  return (
    <ScrollFade className={cn('-mx-gutter -my-2 flex gap-2 px-gutter py-2 scroll-px-4', className)}>
      {actions.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={a.onClick}
          className={cn(
            'button-sm inline-flex h-tap shrink-0 items-center gap-2 rounded-full px-4 whitespace-nowrap [&_svg]:size-4',
            focus,
            press,
            a.primary ? brandFill : 'border border-border bg-secondary text-secondary-foreground hover:bg-accent',
          )}
        >
          {a.icon}
          {a.label}
          {a.primary ? <Keystone className="right-2.5" /> : null}
        </button>
      ))}
    </ScrollFade>
  )
}

export interface SwitchRowProps {
  label: string
  description?: string
  icon?: ReactNode
  checked: boolean
  onCheckedChange: (on: boolean) => void
}

/**
 * Full-row toggle (docs/DESIGN.md §3 switch row). The row is a `<label>`, so the
 * whole row is the target and names the switch; the track centres on the text block.
 */
export function SwitchRow({ label, description, icon, checked, onCheckedChange }: SwitchRowProps) {
  return (
    <label
      data-slot="switch-row"
      className={cn(
        '-mx-2 flex min-h-14 w-[calc(100%+16px)] cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-accent',
        'transition-colors duration-200',
      )}
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
      <HaloSwitch checked={checked} onCheckedChange={(on) => onCheckedChange(on)} />
    </label>
  )
}

/** Empty state: card tile, muted circle with a duotone icon, one line each, one secondary action. */
export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-8 text-center">
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-muted text-foreground [&_svg]:size-6">
        <IconWeight weight="duotone">{icon}</IconWeight>
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

export interface CardProps extends ComponentProps<'div'> {
  /** `shadow-raised` instead of the border. Shadow or border, never both. */
  raised?: boolean
}

/** Card surface used for grouped content inside a view. */
export function Card({ className, raised, ...props }: CardProps) {
  return <div className={cn('rounded-2xl bg-card p-4', raised ? 'shadow-raised' : 'border border-border', className)} {...props} />
}
