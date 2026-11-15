import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { CATEGORIES } from '@/demo'
import { useAppStore } from '@/state/store'
import { CategoryIcon, EmptyState, ListRow, Section } from '@/ui'
import { SearchResultList } from './SearchResultList'
import { useSearchResults } from './useSearchResults'

/**
 * Below the field on the phone's full-screen search: results while typing,
 * categories to browse while empty. `onDone` leaves the search surface (the
 * sheet comes back showing what was picked).
 */
export default function SearchSurface({ onDone }: { onDone: () => void }) {
  const search = useAppStore((s) => s.search)
  const openView = useAppStore((s) => s.openView)
  const { query, category, results, categoryLabel } = useSearchResults()

  if (!query && !category) {
    return (
      <Section title="Browse campus">
        <ul data-testid="search-suggestions">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <ListRow
                icon={<CategoryIcon id={c.id} />}
                title={c.label}
                onClick={() => {
                  // Same rule as the chips: Events and Safety open their own views; the rest filter search.
                  if (c.id === 'events' || c.id === 'safety') openView(c.id)
                  else search('', c.id)
                  onDone()
                }}
              />
            </li>
          ))}
        </ul>
      </Section>
    )
  }

  return (
    <div data-testid="search-results">
      <p className="caption-4 mb-2 text-brand-ink">
        <span className="font-mono">{results.length}</span> {results.length === 1 ? 'result' : 'results'}
        {categoryLabel ? ` in ${categoryLabel}` : null}
      </p>
      {results.length ? (
        <SearchResultList results={results} onPicked={onDone} />
      ) : (
        <EmptyState
          icon={<MagnifyingGlassIcon weight="duotone" />}
          title="Nothing on campus by that name"
          body="Try a building code like DML, a room name, or pick a category."
        />
      )}
    </div>
  )
}
