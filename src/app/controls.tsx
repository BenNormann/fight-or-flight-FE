import { CrosshairIcon, MinusIcon, NavigationArrowIcon, PlusIcon, ShieldCheckIcon, StackIcon } from '@phosphor-icons/react'
import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/cn'
import {
  followTraveller,
  getBearing,
  getCentredOnUser,
  recenter,
  resetNorth,
  subscribeBearing,
  subscribeCentredOnUser,
  zoomIn,
  zoomOut,
} from '@/map/controller'
import { useCategoryChips } from '@/state/places'
import { useAppStore } from '@/state/store'
import { Chip, ChipRow, IconButton, Keystone, SearchBar, CategoryIcon } from '@/ui'

/** Search pill bound to the store. Typing searches live; the results view's own header has the back arrow. */
export function MapSearch({
  overMap = true,
  trailing,
  leading,
  onFocus,
  onEscape,
  onSubmitted,
}: {
  overMap?: boolean
  trailing?: React.ReactNode
  leading?: React.ReactNode
  onFocus?: () => void
  onEscape?: () => void
  /** After Enter: e.g. leave the phone's search surface to show results on the map. */
  onSubmitted?: () => void
}) {
  const query = useAppStore((s) => s.query)
  const category = useAppStore((s) => s.category)
  const search = useAppStore((s) => s.search)
  return (
    <SearchBar
      placeholder="Search University Park campus"
      value={query}
      overMap={overMap}
      onValueChange={(q) => search(q, q ? null : category)}
      onSubmit={(q) => {
        search(q, category)
        onSubmitted?.()
      }}
      leading={leading}
      trailing={trailing}
      onFocus={onFocus}
      onEscape={onEscape}
    />
  )
}

/** Category chips. Events and Safety open their own views; the rest filter search. */
export function CategoryChips({ className, overMap = true, bleed = true }: { className?: string; overMap?: boolean; bleed?: boolean }) {
  const category = useAppStore((s) => s.category)
  const view = useAppStore((s) => s.view)
  const search = useAppStore((s) => s.search)
  const openView = useAppStore((s) => s.openView)
  const chips = useCategoryChips()
  return (
    <ChipRow label="Categories" className={className} bleed={bleed}>
      {chips.map((c) => {
        const opensView = c.view
        const pressed = opensView ? view === opensView : view === 'search' && category === c.id
        return (
          <Chip
            key={c.id}
            overMap={overMap}
            pressed={pressed}
            icon={<CategoryIcon id={c.id} />}
            onClick={() => {
              if (opensView) openView(pressed ? 'explore' : opensView)
              else search('', pressed ? null : c.id)
            }}
          >
            {c.label}
          </Chip>
        )
      })}
    </ChipRow>
  )
}

/** North-up needle: dark north half, muted south half. Not a brand mark. */
function Needle({ bearing }: { bearing: number }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className="size-5" style={{ transform: `rotate(${-bearing}deg)` }}>
      <path d="M10 2 L13.5 10 H6.5 Z" fill="currentColor" />
      <path d="M10 18 L6.5 10 H13.5 Z" className="fill-muted-foreground/60" />
    </svg>
  )
}

/**
 * Always shown in 3D (the mode that rotates), and whenever the map is turned. The needle points
 * north. Tap while rotated: turn north. Tap again at north: back to the orientation before.
 */
function CompassButton() {
  const bearing = useSyncExternalStore(subscribeBearing, getBearing, () => 0)
  const rotates = useAppStore((s) => s.mapMode === '3d')
  const north = Math.abs(bearing) < 0.5
  if (north && !rotates) return null
  return (
    <IconButton
      tone="float"
      label={north ? 'Return to previous orientation' : 'Reset to north'}
      icon={<Needle bearing={bearing} />}
      onClick={resetNorth}
    />
  )
}

/** Right side map controls: compass (3D, or when rotated), layers, locate, the small safety shortcut, and (desktop) zoom. */
export function ControlStack({ className, zoom = false }: { className?: string; zoom?: boolean }) {
  const openView = useAppStore((s) => s.openView)
  const view = useAppStore((s) => s.view)
  // Navigating: this button brings the camera back onto the traveller, heading-up again in 3D.
  const navigating = useAppStore((s) => s.activeRouteId !== null)
  const offTraveller = useAppStore((s) => s.activeRouteId !== null && (!s.navFollowing || s.navAimFree))
  // Not navigating, and the map already sits on you: the button's next press shows the campus, and says so.
  const centred = useSyncExternalStore(subscribeCentredOnUser, getCentredOnUser, () => false)
  const toCampus = !navigating && centred
  return (
    <div className={cn('pointer-events-none flex flex-col gap-2', className)}>
      <CompassButton />
      <IconButton
        tone="float"
        label="Map layers"
        icon={<StackIcon />}
        aria-pressed={view === 'layers'}
        onClick={() => openView(view === 'layers' ? 'explore' : 'layers')}
      />
      <IconButton
        tone="float"
        label={navigating ? 'Recenter on your position' : toCampus ? 'Show USC campus' : 'Show my location'}
        data-next={navigating ? 'traveller' : toCampus ? 'campus' : 'me'}
        data-testid="locate"
        data-off-traveller={offTraveller || undefined}
        // Free camera while navigating: the button stands out until the camera is back on the traveller.
        className={offTraveller ? 'bg-selected! text-selected-foreground!' : undefined}
        icon={toCampus ? <span aria-hidden className="text-[11px] leading-none font-bold tracking-tight">USC</span> : <CrosshairIcon weight={offTraveller ? 'fill' : 'regular'} />}
        onClick={navigating ? followTraveller : recenter}
      />
      <IconButton
        tone="float"
        label="Safety"
        icon={<ShieldCheckIcon />}
        aria-pressed={view === 'safety'}
        onClick={() => openView(view === 'safety' ? 'explore' : 'safety')}
      />
      {zoom ? (
        <>
          <IconButton tone="float" label="Zoom in" icon={<PlusIcon />} onClick={zoomIn} />
          <IconButton tone="float" label="Zoom out" icon={<MinusIcon />} onClick={zoomOut} />
        </>
      ) : null}
    </div>
  )
}

export function DirectionsFab({ className }: { className?: string }) {
  const directionsTo = useAppStore((s) => s.directionsTo)
  const selection = useAppStore((s) => s.selection)
  const target = selection && (selection.kind === 'building' || selection.kind === 'room' || selection.kind === 'poi') ? selection.id : null
  return (
    <button
      type="button"
      data-testid="directions-fab"
      aria-label="Directions"
      onClick={() => directionsTo(target)}
      className={cn(
        'pointer-events-auto relative grid size-fab place-items-center rounded-2xl bg-brand text-brand-accent shadow-brand',
        'outline-none transition-[transform,background-color] duration-200 hover:bg-brand-hover active:scale-[0.98] active:bg-brand-pressed',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <NavigationArrowIcon aria-hidden className="size-6 rotate-90" />
      <Keystone className="top-2 right-2" />
    </button>
  )
}
