import { ArrowLeft, Layers, LocateFixed, Navigation, ShieldCheck } from 'lucide-react'
import { CATEGORIES } from '@/demo'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/state/store'
import { Chip, ChipRow, IconButton, SearchBar, CategoryIcon, notify } from '@/ui'

/** Search pill bound to the store. Typing searches live; the arrow leaves results. */
export function MapSearch({ overMap = true, trailing }: { overMap?: boolean; trailing?: React.ReactNode }) {
  const query = useAppStore((s) => s.query)
  const category = useAppStore((s) => s.category)
  const view = useAppStore((s) => s.view)
  const search = useAppStore((s) => s.search)
  const back = useAppStore((s) => s.back)
  const inResults = view === 'search'
  return (
    <SearchBar
      placeholder="Search Northfield campus"
      value={query}
      overMap={overMap}
      onValueChange={(q) => search(q, q ? null : category)}
      onSubmit={(q) => search(q, category)}
      leading={inResults ? <IconButton className="-ml-3" label="Back to explore" icon={<ArrowLeft />} onClick={back} /> : undefined}
      trailing={trailing}
    />
  )
}

/** Category chips. Events and Safety open their own views; the rest filter search. */
export function CategoryChips({ className, overMap = true }: { className?: string; overMap?: boolean }) {
  const category = useAppStore((s) => s.category)
  const view = useAppStore((s) => s.view)
  const search = useAppStore((s) => s.search)
  const openView = useAppStore((s) => s.openView)
  return (
    <ChipRow label="Categories" className={className}>
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

/** Right side map controls: layers, locate, and the small safety shortcut. */
export function ControlStack({ className }: { className?: string }) {
  const openView = useAppStore((s) => s.openView)
  const view = useAppStore((s) => s.view)
  return (
    <div className={cn('pointer-events-none flex flex-col gap-2', className)}>
      <IconButton
        tone="glass"
        label="Map layers"
        icon={<Layers />}
        aria-pressed={view === 'layers'}
        onClick={() => openView(view === 'layers' ? 'explore' : 'layers')}
      />
      <IconButton
        tone="glass"
        label="Show my location"
        icon={<LocateFixed />}
        onClick={() => notify({ id: 'locate', title: 'Location is not available yet', description: 'The map is showing a campus preview.' })}
      />
      <IconButton
        tone="glass"
        label="Safety"
        icon={<ShieldCheck />}
        aria-pressed={view === 'safety'}
        onClick={() => openView(view === 'safety' ? 'explore' : 'safety')}
      />
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
        'pointer-events-auto grid size-fab place-items-center rounded-2xl bg-brand text-brand-foreground shadow-float',
        'outline-none transition-transform duration-200 hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]',
        className,
      )}
    >
      <Navigation aria-hidden className="size-6" />
    </button>
  )
}
