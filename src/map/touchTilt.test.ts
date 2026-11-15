import { describe, expect, it } from 'vitest'
import { growWithZoom } from './buildings'
import { BUILDINGS_EXTRUDE_ZOOM, BUILDINGS_FULL_HEIGHT_ZOOM } from './camera'
import { classifyTwoFinger } from './touchTilt'

const A = { x: 140, y: 400 }
const B = { x: 250, y: 400 }
const by = (p: { x: number; y: number }, dx: number, dy: number) => ({ x: p.x + dx, y: p.y + dy })

describe('classifyTwoFinger', () => {
  it('waits until a finger has really moved', () => {
    expect(classifyTwoFinger(A, B, by(A, 2, -4), by(B, 0, -3))).toBeNull()
  })

  it('both fingers up together is a tilt, even with a sideways wobble', () => {
    expect(classifyTwoFinger(A, B, by(A, 0, -20), by(B, 0, -20))).toBe('tilt')
    expect(classifyTwoFinger(A, B, by(A, 4, -18), by(B, 3, -20))).toBe('tilt')
  })

  it('one finger lagging behind is still a tilt', () => {
    expect(classifyTwoFinger(A, B, by(A, 0, -14), B)).toBe('tilt')
  })

  it('a slightly diagonal grip still tilts; fingers stacked vertically do not', () => {
    const b = { x: 230, y: 340 }
    expect(classifyTwoFinger(A, b, by(A, 0, -20), by(b, 0, -20))).toBe('tilt')
    const stacked = { x: 160, y: 300 }
    expect(classifyTwoFinger(A, stacked, by(A, 0, -20), by(stacked, 0, -20))).toBe('other')
  })

  it('pinch, twist and sideways drags are not tilts', () => {
    expect(classifyTwoFinger(A, B, by(A, -20, 0), by(B, 20, 0))).toBe('other')
    expect(classifyTwoFinger(A, B, by(A, 0, 25), by(B, 0, -25))).toBe('other')
    expect(classifyTwoFinger(A, B, by(A, 25, 2), by(B, 25, 2))).toBe('other')
  })
})

describe('growWithZoom', () => {
  it('is flat at the extrusion zoom and full height by the full-height zoom', () => {
    expect(growWithZoom(['get', 'h'])).toEqual(['interpolate', ['linear'], ['zoom'], BUILDINGS_EXTRUDE_ZOOM, 0, BUILDINGS_FULL_HEIGHT_ZOOM, ['get', 'h']])
    expect(BUILDINGS_FULL_HEIGHT_ZOOM).toBeGreaterThan(BUILDINGS_EXTRUDE_ZOOM)
  })
})
