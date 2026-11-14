import { Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { HaloSearchInput } from '@/ui/vendor/halo-search'

export interface SearchBarProps {
  placeholder: string
  onSubmit: (query: string) => void
  onFocusChange?: (focused: boolean) => void
  /** e.g. a theme or profile button inside the pill. */
  trailing?: ReactNode
}

/** Floating search pill. 16px input text so iOS never zooms. */
export function SearchBar({ placeholder, onSubmit, onFocusChange, trailing }: SearchBarProps) {
  const [query, setQuery] = useState('')
  return (
    <form
      role="search"
      className="pointer-events-auto w-full"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(query.trim())
      }}
    >
      <HaloSearchInput
        blobTranslucent
        enterKeyHint="search"
        autoComplete="off"
        leading={<Search aria-hidden className="size-5 shrink-0 text-muted-foreground" />}
        onBlur={() => onFocusChange?.(false)}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery('')}
        onFocus={() => onFocusChange?.(true)}
        placeholder={placeholder}
        trailing={trailing}
        value={query}
      />
    </form>
  )
}
