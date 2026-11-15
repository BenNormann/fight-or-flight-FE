import { CrosshairIcon, MinusIcon, NavigationArrowIcon, PlusIcon, ShieldCheckIcon, StackIcon } from '@phosphor-icons/react'
import { CATEGORIES } from '@/demo'
import { cn } from '@/lib/cn'
import { recenter, zoomIn, zoomOut } from '@/map/controller'
import { useAppStore } from '@/state/store'
import { Chip, ChipRow, IconButton, Keystone, SearchBar, CategoryIcon } from '@/ui'

/** Search pill bound to the store. Typing searches live; the results view's own header has the back arrow. */
export function MapSearch({ overMap = true, trailing }: { overMap?: boolean; trailing?: React.ReactNode }) {
  const query = useAppStore((s) => s.query)
  const category = useAppStore((s) => s.category)
  const search = useAppStore((s) => s.search)
  return (
    <SearchBar
      placeholder="Search University Park campus"
      value={query}
      overMap={overMap}
      onValueChange={(q) => search(q, q ? null : category)}
      onSubmit={(q) => search(q, category)}
      trailing={trailing}
    />
  )
}

/** Category chips. Events and Safety open their own views; the rest filter search. */
export function CategoryChips({ className, overMap = true, bleed = true }: { className?: string; overMap?: boolean; bleed?: boolean }) {
  const category = useAppStore((s) => s.category)
  const view = useAppStore((s) => s.view)
  const search = useAppStore((s) => s.search)
  const openView = useAppStore((s) => s.openView)
  return (
    <ChipRow label="Categories" className={className} bleed={bleed}>
      {CATEGORIES.map((c) => {
        const opensView = c.id === 'events' || c.id === 'safety'
        const pressed = opensView ? view === c.id : view === 'search' && category === c.id
        return (
          <Chip
            key={c.id}
            overMap={overMap}
            pressed={pressed}
            icon={<CategoryIcon id={c.id} />}
            onClick={() => {
              if (opensView) openView(pressed ? 'explore' : (c.id as 'events' | 'safety'))
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

/** Right side map controls: layers, locate, the small safety shortcut, and (desktop) zoom. */
export function ControlStack({ className, zoom = false }: { className?: string; zoom?: boolean }) {
  const openView = useAppStore((s) => s.openView)
  const view = useAppStore((s) => s.view)
  return (
    <div className={cn('pointer-events-none flex flex-col gap-2', className)}>
      <IconButton
        tone="float"
        label="Map layers"
        icon={<StackIcon />}
        aria-pressed={view === 'layers'}
        onClick={() => openView(view === 'layers' ? 'explore' : 'layers')}
      />
      <IconButton
        tone="float"
        label="Show my location"
        icon={<CrosshairIcon />}
        onClick={recenter}
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
