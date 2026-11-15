import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useCategoryChips } from '@/state/places'
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
  const { query, category, results, categoryLabel, loading, live } = useSearchResults()
  const chips = useCategoryChips()

  if (!query && !category) {
    return (
      <Section title={live ? 'Browse nearby' : 'Browse campus'}>
        <ul data-testid="search-suggestions">
          {chips.map((c) => (
            <li key={c.id}>
              <ListRow
                icon={<CategoryIcon id={c.id} />}
                title={c.label}
                onClick={() => {
                  // Same rule as the chips: Events and Safety open their own views; the rest filter search.
                  if (c.view) openView(c.view)
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
        {loading && !results.length ? (
          'Searching…'
        ) : (
          <>
            <span className="font-mono">{results.length}</span> {results.length === 1 ? 'result' : 'results'}
          </>
        )}
        {categoryLabel ? ` in ${categoryLabel}` : null}
      </p>
      {results.length ? (
        <SearchResultList results={results} onPicked={onDone} />
      ) : loading ? null : (
        <EmptyState
          icon={<MagnifyingGlassIcon weight="duotone" />}
          title={live ? 'No places match' : 'Nothing on campus by that name'}
          body="Try a building code like DML, a room name, or pick a category."
        />
      )}
    </div>
  )
}
