import { describe, expect, it } from 'vitest'
import { labelFromSlug, parseCategories, parsePlaceDetail, parseSearch, placePath } from './places'

const row = { id: 'gmaps:abc', kind: 'place', name: 'Cafe Dulce', category: 'cafe', subcategory: 'coffee_shop', address: '3096 McClintock Ave', lat: 34.0251, lng: -118.2853, distance_m: 412, rating: 4.5, review_count: 812, open_now: true }

describe('places adapter', () => {
  it('maps search results and skips malformed rows', () => {
    const out = parseSearch({ results: [row, { id: 'x', name: 'No position' }, { ...row, id: 'b', rating: null, review_count: 0, open_now: null, distance_m: null }] })
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ id: 'gmaps:abc', kind: 'place', name: 'Cafe Dulce', category: 'cafe', subcategory: 'coffee_shop', address: '3096 McClintock Ave', lngLat: [-118.2853, 34.0251], distanceM: 412, rating: 4.5, reviewCount: 812, openNow: true })
    expect(out[1]).not.toHaveProperty('rating')
    expect(out[1]).not.toHaveProperty('openNow')
    expect(out[1]).not.toHaveProperty('distanceM')
  })
  it('labels categories, falling back to the id', () => {
    expect(parseCategories([{ id: 'cafe', label: 'Cafes', count: 3, types: [] }, { id: 'bubble_tea', label: null, count: null }])).toEqual([
      { id: 'cafe', label: 'Cafes', count: 3 },
      { id: 'bubble_tea', label: 'Bubble tea', count: 0 },
    ])
    expect(labelFromSlug('coffee_shop')).toBe('Coffee shop')
  })
  it('maps place detail: hours per weekday, safe links, reviews', () => {
    const d = parsePlaceDetail({
      ...row,
      hours: { monday: [{ open: '08:00', close: '22:00' }], friday: [{ open: '18:00', close: '02:00', overnight: true }] },
      phone: ' (213) 555-0100 ',
      website: 'cafedulce.co',
      photo_url: 'javascript:alert(1)',
      reviews: [{ Name: 'A', Description: 'Great donuts', Rating: 5, When: '2 weeks ago' }, { nothing: true }, 'x'],
    })
    expect(d.hours?.monday).toEqual([{ open: '08:00', close: '22:00' }])
    expect(d.hours?.friday).toEqual([{ open: '18:00', close: '02:00', overnight: true }])
    expect(d.hours?.sunday).toEqual([])
    expect(d.phone).toBe('(213) 555-0100')
    expect(d.website).toBe('https://cafedulce.co/')
    expect(d.photoUrl).toBeUndefined()
    expect(d.reviews).toEqual([{ text: 'Great donuts', author: 'A', when: '2 weeks ago', rating: 5 }])
  })
  it('leaves hours undefined when the backend has none', () => {
    expect(parsePlaceDetail({ ...row, hours: null }).hours).toBeUndefined()
  })
  it('encodes ids into the path', () => {
    expect(placePath('gmaps:Ch IJ/x')).toBe('/api/v1/places/gmaps%3ACh%20IJ/x')
  })
})
