/**
 * Device compass heading. Front end only: it orients the traveller and is never sent to the backend.
 * Android: `deviceorientationabsolute` alpha. iOS: `webkitCompassHeading`, after
 * `DeviceOrientationEvent.requestPermission()` from a user gesture (the Start button).
 */
import { wrap360 } from './geo'

interface OrientationLike {
  alpha: number | null
  absolute?: boolean
  webkitCompassHeading?: number
}

/** Heading in degrees from north for the top of the screen, or null when the event carries none. */
export function headingFromOrientation(e: OrientationLike, screenAngleDeg = 0): number | null {
  if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) return wrap360(e.webkitCompassHeading + screenAngleDeg)
  // alpha is counterclockwise from north when the event is absolute.
  if (e.absolute && e.alpha != null && Number.isFinite(e.alpha)) return wrap360(360 - e.alpha + screenAngleDeg)
  return null
}

type PermissionFn = () => Promise<'granted' | 'denied' | 'default'>
const permissionFn = (): PermissionFn | undefined =>
  typeof DeviceOrientationEvent !== 'undefined'
    ? (DeviceOrientationEvent as unknown as { requestPermission?: PermissionFn }).requestPermission
    : undefined

/** iOS asks; everywhere else orientation is available without a prompt. Call from a click or tap handler. */
export async function requestCompassPermission(): Promise<boolean> {
  const ask = permissionFn()
  if (!ask) return true
  try {
    return (await ask.call(DeviceOrientationEvent)) === 'granted'
  } catch {
    return false
  }
}

const screenAngle = () => (typeof screen !== 'undefined' && screen.orientation ? screen.orientation.angle : 0)

/** Calls back with each compass reading. Silent (no calls) when the device has no compass or permission. */
export function watchCompass(onHeading: (deg: number, t: number) => void, now = () => performance.now()): () => void {
  if (typeof window === 'undefined') return () => {}
  const type = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
  const handler = (e: Event) => {
    const deg = headingFromOrientation(e as unknown as OrientationLike, screenAngle())
    if (deg !== null) onHeading(deg, now())
  }
  window.addEventListener(type, handler)
  return () => window.removeEventListener(type, handler)
}
