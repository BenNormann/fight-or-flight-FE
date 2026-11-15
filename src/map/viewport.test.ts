import { describe, expect, it } from 'vitest'
import {
  ZOOM_MAX,
  ZOOM_MIN,
  clampView,
  isDoubleTap,
  isDrag,
  pan,
  pinch,
  screenToGround,
  wheelFactor,
  zoomAt,
  type Tilt,
  type View,
} from './viewport'

const flat: Tilt = { rotateX: 0, rotateZ: 0, scale: 1 }
const iso: Tilt = { rotateX: 52, rotateZ: -38, scale: 1.05 }
const v0: View = { cx: 800, cy: 800, zoom: 1 }
const bounds = { size: 1600, viewportW: 390, viewportH: 844 }

/** Forward of screenToGround: ground delta to screen delta (orthographic). */
function groundToScreen(gx: number, gy: number, t: Tilt): [number, number] {
  const z = (t.rotateZ * Math.PI) / 180
  const x = gx * Math.cos(z) - gy * Math.sin(z)
  const y = gx * Math.sin(z) + gy * Math.cos(z)
  return [x * t.scale, y * Math.cos((t.rotateX * Math.PI) / 180) * t.scale]
}

describe('screenToGround', () => {
  it('is identity when flat', () => {
    expect(screenToGround(10, -20, flat)).toEqual([10, -20])
  })
  it('inverts the tilt', () => {
    const [gx, gy] = screenToGround(37, -12, iso)
    const [sx, sy] = groundToScreen(gx, gy, iso)
    expect(sx).toBeCloseTo(37)
    expect(sy).toBeCloseTo(-12)
  })
})

describe('pan', () => {
  it('moves the centre against the drag, scaled by zoom', () => {
    expect(pan(v0, 100, 50, flat)).toEqual({ cx: 700, cy: 750, zoom: 1 })
    expect(pan({ ...v0, zoom: 2 }, 100, 50, flat)).toEqual({ cx: 750, cy: 775, zoom: 2 })
  })
})

describe('zoomAt', () => {
  it('zooms about the centre without moving it', () => {
    expect(zoomAt(v0, 2, 0, 0, iso)).toEqual({ cx: 800, cy: 800, zoom: 2 })
  })
  it('keeps the ground point under the anchor fixed', () => {
    const anchor: [number, number] = [120, -80]
    const under = (v: View) => {
      const [gx, gy] = screenToGround(anchor[0], anchor[1], iso)
      return [v.cx + gx / v.zoom, v.cy + gy / v.zoom]
    }
    const before = under(v0)
    const after = under(zoomAt(v0, 1.7, anchor[0], anchor[1], iso))
    expect(after[0]).toBeCloseTo(before[0]!)
    expect(after[1]).toBeCloseTo(before[1]!)
  })
  it('clamps zoom', () => {
    expect(zoomAt(v0, 100, 0, 0, flat).zoom).toBe(ZOOM_MAX)
    expect(zoomAt(v0, 0.01, 0, 0, flat).zoom).toBe(ZOOM_MIN)
  })
})

describe('wheelFactor', () => {
  it('zooms in on wheel up and is symmetric', () => {
    expect(wheelFactor(-400)).toBeCloseTo(2)
    expect(wheelFactor(400)).toBeCloseTo(0.5)
    expect(wheelFactor(0)).toBe(1)
  })
})

describe('clampView', () => {
  it('stops the centre where the plane edge meets the screen edge', () => {
    expect(clampView({ cx: -500, cy: 5000, zoom: 1 }, bounds, flat)).toEqual({ cx: 195, cy: 1600 - 422, zoom: 1 })
  })
  it('locks an axis to the middle when the plane is smaller than the viewport', () => {
    expect(clampView({ cx: 100, cy: 100, zoom: 0.5 }, bounds, flat)).toEqual({ cx: 390, cy: 800, zoom: 0.5 })
  })
  it('leaves a view inside bounds untouched', () => {
    expect(clampView(v0, bounds, flat)).toEqual(v0)
  })
})

describe('pinch', () => {
  it('spreading fingers zooms in', () => {
    const next = pinch(v0, { mx: 0, my: 0, dist: 100 }, { mx: 0, my: 0, dist: 200 }, flat)
    expect(next).toEqual({ cx: 800, cy: 800, zoom: 2 })
  })
  it('moving the midpoint pans', () => {
    const next = pinch(v0, { mx: 0, my: 0, dist: 100 }, { mx: 40, my: 0, dist: 100 }, flat)
    expect(next).toEqual({ cx: 760, cy: 800, zoom: 1 })
  })
})

describe('gestures', () => {
  it('isDrag uses a slop radius', () => {
    expect(isDrag(3, 3)).toBe(false)
    expect(isDrag(6, 4)).toBe(true)
  })
  it('isDoubleTap needs time and distance', () => {
    const a = { t: 0, x: 10, y: 10 }
    expect(isDoubleTap(null, a)).toBe(false)
    expect(isDoubleTap(a, { t: 250, x: 20, y: 15 })).toBe(true)
    expect(isDoubleTap(a, { t: 400, x: 10, y: 10 })).toBe(false)
    expect(isDoubleTap(a, { t: 100, x: 80, y: 10 })).toBe(false)
  })
})
