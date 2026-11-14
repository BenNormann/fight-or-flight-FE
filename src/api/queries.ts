/**
 * All TanStack Query hooks and query keys. UI and map code get server data only from here,
 * always as domain types.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchConfig } from './adapters/config'

export const queryKeys = {
  config: ['config'] as const,
}

export function useAppConfig() {
  return useQuery({
    queryKey: queryKeys.config,
    queryFn: ({ signal }) => fetchConfig(signal),
    staleTime: Infinity,
    retry: 1,
  })
}
