/**
 * DEMO DATA (see ./index.ts). Kept in its own module because it pulls in h3-js,
 * which must stay out of the initial bundle: only the lazy map chunk imports this.
 */
import { cellToBoundary, gridDisk, latLngToCell } from 'h3-js'
import type { LngLat } from '@/domain'
import { CAMPUS_CENTER, project } from './index'

/** Fake risk hotspots for the safety heat toggle: [lng, lat, radius m, peak score]. */
const riskHotspots: [number, number, number, number][] = [
  [-118.2864, 34.019, 260, 0.78],
  [-118.2808, 34.0205, 320, 0.6],
  [-118.2915, 34.026, 300, 0.5],
  [-118.2785, 34.0262, 280, 0.42],
]

/** H3 resolution of the demo heat, matching the backend's crime cells. */
export const DEMO_RISK_RES = 9

/** Demo heat as H3 cells around campus. The real one comes from the backend. */
export function demoRiskCells(): { cell: string; score: number; boundary: LngLat[] }[] {
  const centre = latLngToCell(CAMPUS_CENTER[1], CAMPUS_CENTER[0], DEMO_RISK_RES)
  return gridDisk(centre, 9).map((cell) => {
    const boundary = cellToBoundary(cell, true) as LngLat[]
    const [cx, cy] = project(boundary.reduce<LngLat>((a, p) => [a[0] + p[0] / boundary.length, a[1] + p[1] / boundary.length], [0, 0]))
    const score = riskHotspots.reduce((best, [lng, lat, r, peak]) => {
      const [hx, hy] = project([lng, lat])
      const d = Math.hypot(cx - hx, cy - hy)
      return Math.max(best, peak * Math.max(0, 1 - d / (r * 2)))
    }, 0.06)
    return { cell, score: Math.round(score * 100) / 100, boundary }
  })
}
