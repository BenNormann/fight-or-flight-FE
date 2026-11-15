import type { SearchResult } from '@/domain'
import { useAppStore } from '@/state/store'
import { ListRow, PlaceIcon } from '@/ui'

const kindLabel: Record<SearchResult['kind'], string> = { building: 'Building', room: 'Room', poi: 'Place', event: 'Event', place: 'Place' }

/** Result rows. Picking one selects it (which opens its view at half). */
export function SearchResultList({ results, onPicked }: { results: SearchResult[]; onPicked?: () => void }) {
  const selection = useAppStore((s) => s.selection)
  const select = useAppStore((s) => s.select)
  return (
    <ul>
      {results.map((r) => (
        <li key={`${r.kind}-${r.id}`}>
          <ListRow
            icon={<PlaceIcon type={r.kind} />}
            title={r.label}
            subtitle={r.sublabel ?? kindLabel[r.kind]}
            meta={r.meta ? <span className="font-mono">{r.meta}</span> : kindLabel[r.kind]}
            selected={selection?.kind === r.kind && selection.id === r.id}
            onClick={() => {
              select({ kind: r.kind, id: r.id })
              onPicked?.()
            }}
          />
        </li>
      ))}
    </ul>
  )
}
