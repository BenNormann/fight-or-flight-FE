const raw = import.meta.env

/**
 * The backend's origin only. Anything after the host is dropped, so a pasted endpoint such as
 * `https://host/api/v1/health` still works: every path already starts with `/api/v1`.
 */
export function apiOrigin(value: string | undefined): string | undefined {
  const v = value?.trim()
  if (!v) return undefined
  try {
    return new URL(v).origin
  } catch {
    return v.replace(/\/+$/, '')
  }
}

const apiUrl = apiOrigin(raw.VITE_API_URL as string | undefined)
// Case-insensitive: `FALSE` and `True` in a host's settings mean what they say.
const mocksFlag = (raw.VITE_USE_MOCKS as string | undefined)?.trim().toLowerCase()

export const env = {
  apiUrl,
  /** Mock mode is the default whenever no backend URL is set. */
  useMocks: mocksFlag === 'true' || (!apiUrl && mocksFlag !== 'false'),
  /** Optional basemap override; wins over the backend config. */
  mapStyleUrl: (raw.VITE_MAP_STYLE_URL as string | undefined) || undefined,
  /** In dev, requests go to the Vite proxy (same origin). In prod, straight to the backend. */
  apiBase: raw.DEV ? '' : (apiUrl ?? ''),
} as const
