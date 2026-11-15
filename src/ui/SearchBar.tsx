import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { HaloSearchInput } from '@/ui/vendor/halo-search'

export interface SearchBarProps {
  placeholder: string
  value: string
  onValueChange: (value: string) => void
  onSubmit: (query: string) => void
  onFocusChange?: (focused: boolean) => void
  /** Replaces the search icon (e.g. a back button). */
  leading?: ReactNode
  /** e.g. a theme or profile button inside the pill. */
  trailing?: ReactNode
  /** Solid surface inside the desktop panel; frosted over the map. */
  overMap?: boolean
}

/** Search pill. 16px input text so iOS never zooms. */
export function SearchBar({
  placeholder,
  value,
  onValueChange,
  onSubmit,
  onFocusChange,
  leading,
  trailing,
  overMap = true,
}: SearchBarProps) {
  return (
    <form
      role="search"
      className="pointer-events-auto w-full"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(value.trim())
      }}
    >
      <HaloSearchInput
        blobTranslucent={overMap}
        enterKeyHint="search"
        autoComplete="off"
        aria-label={placeholder}
        leading={leading ?? <MagnifyingGlassIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
        onBlur={() => onFocusChange?.(false)}
        onChange={(e) => onValueChange(e.target.value)}
        onClear={() => onValueChange('')}
        onFocus={() => onFocusChange?.(true)}
        placeholder={placeholder}
        trailing={trailing}
        value={value}
      />
    </form>
  )
}
