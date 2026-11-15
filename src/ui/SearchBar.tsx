import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { Suspense, lazy, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Lazy: the animated field is not needed for first paint; a static pill with the same box stands in. */
const HaloSearchInput = lazy(() => import('@/ui/vendor/halo-search').then((m) => ({ default: m.HaloSearchInput })))

export interface SearchBarProps {
  placeholder: string
  value: string
  onValueChange: (value: string) => void
  onSubmit: (query: string) => void
  /** Replaces the search icon (e.g. a back button). */
  leading?: ReactNode
  /** e.g. a theme or profile button inside the pill. */
  trailing?: ReactNode
  /** Over the map: float shadow. Inside the desktop panel: border. */
  overMap?: boolean
  onFocus?: () => void
  /** Escape in the field (e.g. leave a search surface). */
  onEscape?: () => void
}

/** Search pill. 16px input text so iOS never zooms. */
export function SearchBar({ placeholder, value, onValueChange, onSubmit, leading, trailing, overMap = true, onFocus, onEscape }: SearchBarProps) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onEscape?.()
  }
  const icon = leading ?? <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
  const fallback = (
    <div
      className={cn(
        'relative flex min-h-tap items-center gap-2 rounded-full bg-card pr-1 pl-4',
        overMap ? 'shadow-float' : 'border border-border',
      )}
    >
      {icon}
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        className="h-full min-h-12 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-foreground/70 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {trailing}
    </div>
  )
  return (
    <form
      role="search"
      className="pointer-events-auto w-full"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(value.trim())
      }}
    >
      <Suspense fallback={fallback}>
        <HaloSearchInput
          blobTranslucent={overMap}
          enterKeyHint="search"
          autoComplete="off"
          aria-label={placeholder}
          leading={icon}
          onChange={(e) => onValueChange(e.target.value)}
          onClear={() => onValueChange('')}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          trailing={trailing}
          value={value}
        />
      </Suspense>
    </form>
  )
}
