import { CATEGORIES, demoSearch } from '@/demo'
import { useAppStore } from '@/state/store'

/** The current query, category and their results. */
export function useSearchResults() {
  const query = useAppStore((s) => s.query)
  const category = useAppStore((s) => s.category)
  return { query, category, results: demoSearch(query, category), categoryLabel: CATEGORIES.find((c) => c.id === category)?.label }
}
