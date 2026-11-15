/**
 * Places adapter (docs/BACKEND_CONTRACT.md, "Search"):
 *   GET /api/v1/search?q=&near=lat,lng&category=&limit=   -> Place[]
 *   GET /api/v1/search/categories                         -> PlaceCategory[]
 *   GET /api/v1/places/{id}?near=lat,lng                  -> PlaceDetail
 *   GET /api/v1/geocode/reverse?at=lat,lng                -> a name for a point
 * Loose on what is accepted: scraped place data is uneven, so every optional field may be missing or null.
 */
import { z } from 'zod'
import { apiFetch, ApiError } from '@/api/client'
import { WEEKDAYS, type LngLat, type OpenSpan, type Place, type PlaceCategory, type PlaceDetail, type PlaceReview, type Weekday } from '@/domain'

export const SEARCH_PATH = '/api/v1/search'
export const CATEGORIES_PATH = '/api/v1/search/categories'
export const placePath = (id: string) => `/api/v1/places/${id.split('/').map(encodeURIComponent).join('/')}`
export const REVERSE_PATH = '/api/v1/geocode/reverse'

const latLng = ([lng, lat]: LngLat) => `${lat.toFixed(6)},${lng.toFixed(6)}`
const text = z.string().nullish()
const num = z.number().nullish()

const backendPlace = z.looseObject({
  id: z.string(),
  kind: text,
  name: z.string(),
  category: text,
  subcategory: text,
  address: text,
  lat: z.number(),
  lng: z.number(),
  distance_m: num,
  rating: num,
  review_count: num,
  open_now: z.boolean().nullish(),
})

const clean = (s: string | null | undefined) => (s && s.trim() ? s.trim() : undefined)
/** "bubble_tea_store" -> "Bubble tea store". */
export const labelFromSlug = (slug: string) => {
  const s = slug.replace(/[_-]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function toPlace(p: z.infer<typeof backendPlace>): Place {
  return {
    id: p.id,
    kind: clean(p.kind) ?? 'place',
    name: p.name,
    category: clean(p.category),
    subcategory: clean(p.subcategory),
    address: clean(p.address),
    lngLat: [p.lng, p.lat],
    ...(p.distance_m != null ? { distanceM: p.distance_m } : {}),
    ...(p.rating != null && p.rating > 0 ? { rating: p.rating } : {}),
    ...(p.review_count != null && p.review_count > 0 ? { reviewCount: p.review_count } : {}),
    ...(p.open_now != null ? { openNow: p.open_now } : {}),
  }
}

export function parseSearch(raw: unknown): Place[] {
  const body = z.looseObject({ results: z.array(z.unknown()) }).parse(raw)
  // One malformed row must not empty the whole list.
  return body.results.flatMap((r) => {
    const p = backendPlace.safeParse(r)
    return p.success ? [toPlace(p.data)] : []
  })
}

export interface PlaceSearch {
  q?: string
  /** Top-level category ids. */
  category?: string
  near?: LngLat
  limit?: number
}

export async function searchPlaces(s: PlaceSearch, signal?: AbortSignal): Promise<Place[]> {
  return parseSearch(
    await apiFetch(SEARCH_PATH, { query: { q: s.q || undefined, category: s.category, near: s.near ? latLng(s.near) : undefined, limit: s.limit ?? 25 }, signal }),
  )
}

const backendCategory = z.looseObject({ id: z.string(), label: text, count: num })

export function parseCategories(raw: unknown): PlaceCategory[] {
  return z
    .array(backendCategory)
    .parse(raw)
    .map((c) => ({ id: c.id, label: clean(c.label) ?? labelFromSlug(c.id), count: c.count ?? 0 }))
}

export async function fetchPlaceCategories(signal?: AbortSignal): Promise<PlaceCategory[]> {
  return parseCategories(await apiFetch(CATEGORIES_PATH, { signal }))
}

const span = z.looseObject({ open: z.string(), close: z.string(), overnight: z.boolean().nullish(), all_day: z.boolean().nullish() })
const backendDetail = backendPlace.extend({
  hours: z.record(z.string(), z.array(span)).nullish(),
  phone: text,
  website: text,
  photo_url: text,
  description: text,
  reviews: z.array(z.unknown()).nullish(),
})

/** Scraped reviews come with whatever keys the scraper used. */
function toReview(raw: unknown): PlaceReview[] {
  if (!raw || typeof raw !== 'object') return []
  const r = raw as Record<string, unknown>
  const pick = (...keys: string[]) => {
    for (const k of keys) if (typeof r[k] === 'string' && r[k].trim()) return r[k].trim()
    return undefined
  }
  const body = pick('text', 'description', 'Description', 'review', 'comment')
  if (!body) return []
  const rating = [r.rating, r.Rating].find((v) => typeof v === 'number')
  return [{ text: body, author: pick('author', 'name', 'Name'), when: pick('when', 'When', 'date'), ...(typeof rating === 'number' ? { rating } : {}) }]
}

/** Only http(s) links leave the adapter: the value comes from scraped data. */
const safeUrl = (s: string | null | undefined) => {
  const v = clean(s)
  if (!v) return undefined
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined
  } catch {
    return undefined
  }
}

export function parsePlaceDetail(raw: unknown): PlaceDetail {
  const d = backendDetail.parse(raw)
  let hours: PlaceDetail['hours']
  if (d.hours) {
    hours = {} as Record<Weekday, OpenSpan[]>
    for (const day of WEEKDAYS)
      hours[day] = (d.hours[day] ?? []).map((s) => ({ open: s.open, close: s.close, ...(s.overnight ? { overnight: true } : {}), ...(s.all_day ? { allDay: true } : {}) }))
  }
  return {
    ...toPlace(d),
    hours,
    phone: clean(d.phone),
    website: safeUrl(d.website),
    photoUrl: safeUrl(d.photo_url),
    description: clean(d.description),
    reviews: (d.reviews ?? []).flatMap(toReview).slice(0, 5),
  }
}

export async function fetchPlace(id: string, near?: LngLat, signal?: AbortSignal): Promise<PlaceDetail> {
  return parsePlaceDetail(await apiFetch(placePath(id), { query: { near: near ? latLng(near) : undefined }, signal }))
}

const backendReverse = z.looseObject({ name: text, address: text })

/** A short name for a point ("West 35th Street", "Doheny Memorial Library"), or null when nothing is near. */
export async function reverseGeocode(at: LngLat, signal?: AbortSignal): Promise<string | null> {
  try {
    const r = backendReverse.parse(await apiFetch(REVERSE_PATH, { query: { at: latLng(at) }, signal }))
    return clean(r.name) ?? clean(r.address) ?? null
  } catch (e) {
    // 404 here means "nothing named near this point", not "endpoint missing".
    if (e instanceof ApiError && e.status === 404) return null
    throw e
  }
}
