import { SearchX } from 'lucide-react'
import { CATEGORIES, demoSearch } from '@/demo'
import type { SearchResult } from '@/domain'
import { useAppStore } from '@/state/store'
import { Button, EmptyState, ListRow, PlaceIcon, ViewHeader } from '@/ui'

const kindLabel: Record<SearchResult['kind'], string> = { building: 'Building', room: 'Room', poi: 'Place', event: 'Event' }

export default function SearchView() {
  const query = useAppStore((s) => s.query)
  const category = useAppStore((s) => s.category)
  const select = useAppStore((s) => s.select)
  const back = useAppStore((s) => s.back)
  const results = demoSearch(query, category)
  const catLabel = CATEGORIES.find((c) => c.id === category)?.label

  return (
    <div data-testid="view-search">
      <ViewHeader
        eyebrow={`${results.length} ${results.length === 1 ? 'result' : 'results'}`}
        title={query ? `“${query}”` : (catLabel ?? 'Search')}
        subtitle={query && catLabel ? `In ${catLabel}` : undefined}
        onBack={back}
      />
      {results.length ? (
        <ul>
          {results.map((r) => (
            <li key={`${r.kind}-${r.id}`}>
              <ListRow
                icon={<PlaceIcon type={r.kind} />}
                title={r.label}
                subtitle={r.sublabel ?? kindLabel[r.kind]}
                meta={kindLabel[r.kind]}
                onClick={() => select({ kind: r.kind, id: r.id })}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<SearchX />}
          title="No matches on campus"
          body="Try a building code like HOL, a room name, or pick a category."
          action={<Button onClick={back}>Clear search</Button>}
        />
      )}
    </div>
  )
}
