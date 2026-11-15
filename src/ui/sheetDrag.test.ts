import { describe, expect, it } from 'vitest'
import { dragOwner, releaseSnap, rubberBand, snapOffsets } from './sheetDrag'

const o = snapOffsets(844, 96)

describe('sheet drag', () => {
  it('offsets: full at the top, half at the middle, peek showing its strip', () => {
    expect(o).toEqual({ full: 0, half: 422, peek: 748 })
  })

  it('peek and half: a vertical drag anywhere moves the sheet', () => {
    for (const snap of ['peek', 'half'] as const) {
      expect(dragOwner({ snap, onHeader: false, scrollTop: 0, dx: 1, dy: -20 })).toBe('sheet')
      expect(dragOwner({ snap, onHeader: false, scrollTop: 0, dx: 0, dy: 20 })).toBe('sheet')
    }
  })

  it('full: content scrolls, except a downward drag from scroll-top', () => {
    expect(dragOwner({ snap: 'full', onHeader: false, scrollTop: 0, dx: 0, dy: -10 })).toBe('content')
    expect(dragOwner({ snap: 'full', onHeader: false, scrollTop: 120, dx: 0, dy: 10 })).toBe('content')
    expect(dragOwner({ snap: 'full', onHeader: false, scrollTop: 0, dx: 0, dy: 10 })).toBe('sheet')
  })

  it('the header always drags; sideways drags are left alone', () => {
    expect(dragOwner({ snap: 'full', onHeader: true, scrollTop: 300, dx: 0, dy: -10 })).toBe('sheet')
    expect(dragOwner({ snap: 'half', onHeader: false, scrollTop: 0, dx: 30, dy: 5 })).toBe('none')
  })

  it('settles on the nearest snap, or one step on a flick', () => {
    expect(releaseSnap('peek', 450, 0, o)).toBe('half')
    expect(releaseSnap('half', 60, 0, o)).toBe('full')
    expect(releaseSnap('half', 410, -1500, o)).toBe('full')
    expect(releaseSnap('half', 430, 1500, o)).toBe('peek')
    expect(releaseSnap('full', 0, -2000, o)).toBe('full')
  })

  it('resists past the ends', () => {
    expect(rubberBand(-100, o)).toBe(-20)
    expect(rubberBand(848, o)).toBe(768)
    expect(rubberBand(300, o)).toBe(300)
  })
})
