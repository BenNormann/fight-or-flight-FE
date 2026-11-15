import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useAppStore } from '@/state/store'
import { Button, EmptyState, ViewHeader } from '@/ui'
import { SearchResultList } from './SearchResultList'
import { useSearchResults } from './useSearchResults'

export default function SearchView() {
  const back = useAppStore((s) => s.back)
  const { query, results, categoryLabel, loading, live, failed } = useSearchResults()

  return (
    <div data-testid="view-search">
      <ViewHeader
        eyebrow={
          <>
            {loading && !results.length ? 'Searching…' : (
              <>
                <span className="font-mono">{results.length}</span> {results.length === 1 ? 'result' : 'results'}
              </>
            )}
          </>
        }
        title={query ? `“${query}”` : (categoryLabel ?? 'Search')}
        subtitle={query && categoryLabel ? `In ${categoryLabel}` : undefined}
        onBack={back}
      />
      {results.length ? (
        <SearchResultList results={results} />
      ) : loading ? (
        <div role="status" aria-label="Searching" className="grid gap-3" data-testid="search-loading">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          ))}
        </div>
      ) : failed ? (
        <EmptyState icon={<MagnifyingGlassIcon weight="duotone" />} title="Search is not responding" body="Check your connection and try again." action={<Button onClick={back}>Clear search</Button>} />
      ) : live ? (
        <EmptyState
          icon={<MagnifyingGlassIcon weight="duotone" />}
          title="No places match"
          body="Try a shorter name, a building code like DML, or a category such as coffee."
          action={<Button onClick={back}>Clear search</Button>}
        />
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
