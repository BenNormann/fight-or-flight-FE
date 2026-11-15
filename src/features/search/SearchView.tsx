import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useAppStore } from '@/state/store'
import { Button, EmptyState, ViewHeader } from '@/ui'
import { SearchResultList } from './SearchResultList'
import { useSearchResults } from './useSearchResults'

export default function SearchView() {
  const back = useAppStore((s) => s.back)
  const { query, results, categoryLabel } = useSearchResults()

  return (
    <div data-testid="view-search">
      <ViewHeader
        eyebrow={
          <>
            <span className="font-mono">{results.length}</span> {results.length === 1 ? 'result' : 'results'}
          </>
        }
        title={query ? `“${query}”` : (categoryLabel ?? 'Search')}
        subtitle={query && categoryLabel ? `In ${categoryLabel}` : undefined}
        onBack={back}
      />
      {results.length ? (
        <SearchResultList results={results} />
      ) : (
        <EmptyState
          icon={<MagnifyingGlassIcon weight="duotone" />}
          title="Nothing on campus by that name"
          body="Try a building code like DML, a room name, or pick a category."
          action={<Button onClick={back}>Clear search</Button>}
        />
      )}
    </div>
  )
}
