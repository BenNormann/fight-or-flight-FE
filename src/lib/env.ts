const raw = import.meta.env

const apiUrl = (raw.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || undefined
const mocksFlag = raw.VITE_USE_MOCKS as string | undefined

export const env = {
  apiUrl,
  /** Mock mode is the default whenever no backend URL is set. */
  useMocks: mocksFlag === 'true' || (!apiUrl && mocksFlag !== 'false'),
  /** Optional basemap override; wins over the backend config. */
  mapStyleUrl: (raw.VITE_MAP_STYLE_URL as string | undefined) || undefined,
  /** In dev, requests go to the Vite proxy (same origin). In prod, straight to the backend. */
  apiBase: raw.DEV ? '' : (apiUrl ?? ''),
} as const
