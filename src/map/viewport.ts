/**
 * Pan and zoom maths for the placeholder map. Pure functions, no DOM.
 *
 * The view is a centre point on the ground plane (plane px) and a zoom factor.
 * The tilt (rotateZ then rotateX then scale, as CSS applies it) is inverted
 * orthographically to turn a screen delta into a ground delta. Perspective is
 * ignored, which is close enough for a placeholder.
 */

export interface View {
  cx: number
  cy: number
  zoom: number
}

export interface Tilt {
  /** Degrees. */
  rotateX: number
  /** Degrees. */
  rotateZ: number
  scale: number
}

export interface Bounds {
  /** Ground plane is `size` by `size` plane px. */
  size: number
  viewportW: number
  viewportH: number
}

export const ZOOM_MIN = 0.5
export const ZOOM_MAX = 4
/** Wheel delta (px) that doubles or halves the zoom. */
export const WHEEL_PX_PER_DOUBLING = 400

const rad = (deg: number) => (deg * Math.PI) / 180

/** Screen delta (px) to ground delta (plane px) at zoom 1. */
export function screenToGround(dx: number, dy: number, tilt: Tilt): [number, number] {
  const cosX = Math.max(Math.cos(rad(tilt.rotateX)), 0.2)
  const ux = dx / tilt.scale
  const uy = dy / (tilt.scale * cosX)
  const t = rad(-tilt.rotateZ)
  return [ux * Math.cos(t) - uy * Math.sin(t), ux * Math.sin(t) + uy * Math.cos(t)]
}

export const clampZoom = (zoom: number, min = ZOOM_MIN, max = ZOOM_MAX) => Math.min(max, Math.max(min, zoom))

/** Move the view so the ground follows a screen drag of (dx, dy). */
export function pan(view: View, dx: number, dy: number, tilt: Tilt): View {
  const [gx, gy] = screenToGround(dx, dy, tilt)
  return { ...view, cx: view.cx - gx / view.zoom, cy: view.cy - gy / view.zoom }
}

/**
 * Zoom by `factor`, keeping the ground point under the screen point (ax, ay) fixed.
 * (ax, ay) is measured from the screen position of the view centre.
 */
export function zoomAt(view: View, factor: number, ax: number, ay: number, tilt: Tilt): View {
  const zoom = clampZoom(view.zoom * factor)
  const [gx, gy] = screenToGround(ax, ay, tilt)
  const k = 1 / view.zoom - 1 / zoom
  return { cx: view.cx + gx * k, cy: view.cy + gy * k, zoom }
}

/** Wheel delta to a zoom factor: negative delta (wheel up) zooms in. */
export const wheelFactor = (deltaY: number) => 2 ** (-deltaY / WHEEL_PX_PER_DOUBLING)

/**
 * Keep the plane under the viewport: the centre may travel until a plane edge
 * reaches the screen edge. When the plane is smaller than the viewport on an
 * axis the centre locks to the middle.
 */
export function clampView(view: View, b: Bounds, tilt: Tilt): View {
  const zoom = clampZoom(view.zoom)
  const halfW = b.viewportW / 2 / (zoom * tilt.scale)
  const halfH = b.viewportH / 2 / (zoom * tilt.scale)
  const axis = (c: number, half: number) => (half * 2 >= b.size ? b.size / 2 : Math.min(b.size - half, Math.max(half, c)))
  return { cx: axis(view.cx, halfW), cy: axis(view.cy, halfH), zoom }
}

/** Pinch: zoom by the distance ratio about the old midpoint, then pan by the midpoint's travel. */
export function pinch(
  view: View,
  prev: { mx: number; my: number; dist: number },
  next: { mx: number; my: number; dist: number },
  tilt: Tilt,
): View {
  const zoomed = prev.dist > 0 ? zoomAt(view, next.dist / prev.dist, prev.mx, prev.my, tilt) : view
  return pan(zoomed, next.mx - prev.mx, next.my - prev.my, tilt)
}

/** Movement (px) before a press becomes a drag and stops being a tap. */
export const DRAG_SLOP_PX = 6
export const isDrag = (dx: number, dy: number, slop = DRAG_SLOP_PX) => dx * dx + dy * dy > slop * slop

/** Double tap: second tap within this time and distance of the first. */
export const DOUBLE_TAP_MS = 300
export const DOUBLE_TAP_PX = 24
export const isDoubleTap = (prev: { t: number; x: number; y: number } | null, next: { t: number; x: number; y: number }) =>
  !!prev && next.t - prev.t <= DOUBLE_TAP_MS && Math.hypot(next.x - prev.x, next.y - prev.y) <= DOUBLE_TAP_PX
