import { describe, expect, it } from 'vitest'
import { bboxOf, boundsAround, cameraPresets } from './camera'

describe('camera', () => {
  it('only 3D rotates; 2D is flat and north up', () => {
    expect(cameraPresets['2d']).toMatchObject({ pitch: 0, bearing: 0, rotate: false })
    expect(cameraPresets.iso.rotate).toBe(false)
    expect(cameraPresets['3d'].rotate).toBe(true)
  })

  it('bounds are about 16 km each way', () => {
    const [[w, s], [e, n]] = boundsAround([-118.2851, 34.0224])
    expect((n - s) * 111_320).toBeCloseTo(32_000, -2)
    expect(e - w).toBeGreaterThan(n - s) // longitude degrees are shorter at 34°N
  })

  it('bboxOf', () => {
    expect(bboxOf([])).toBeNull()
    expect(bboxOf([[1, 5], [3, 2]])).toEqual([[1, 2], [3, 5]])
  })
})
