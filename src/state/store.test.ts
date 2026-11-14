import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './store'

const initial = useAppStore.getState()
beforeEach(() => useAppStore.setState(initial, true))

describe('store navigation', () => {
  it('selecting a building opens the place view at half', () => {
    useAppStore.getState().select({ kind: 'building', id: 'b1' })
    const s = useAppStore.getState()
    expect(s.view).toBe('place')
    expect(s.sheetSnap).toBe('half')
  })

  it('selecting a route or event opens its own view', () => {
    useAppStore.getState().select({ kind: 'route', id: 'r1' })
    expect(useAppStore.getState().view).toBe('directions')
    useAppStore.getState().select({ kind: 'event', id: 'e1' })
    expect(useAppStore.getState().view).toBe('events')
  })

  it('back from a place returns to search results when a query is active', () => {
    useAppStore.getState().search('library')
    useAppStore.getState().select({ kind: 'building', id: 'b1' })
    useAppStore.getState().back()
    expect(useAppStore.getState().view).toBe('search')
    useAppStore.getState().back()
    expect(useAppStore.getState().view).toBe('explore')
    expect(useAppStore.getState().query).toBe('')
  })

  it('directions keep the destination; starting collapses the sheet', () => {
    useAppStore.getState().directionsTo('b2')
    expect(useAppStore.getState()).toMatchObject({ view: 'directions', destination: 'b2' })
    useAppStore.getState().startRoute('r-safe')
    expect(useAppStore.getState()).toMatchObject({ activeRouteId: 'r-safe', sheetSnap: 'peek' })
  })
})
