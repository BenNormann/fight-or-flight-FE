/** Demo mode: simulated crimes on the map. A red pin, and a faint disc for the area routes avoid. */
import type { SimulatedIncident } from '@/domain'
import { fromLocal } from '@/lib/nav'

export const DEMO_INCIDENT_SOURCE = 'fof-demo-incidents'
export const DEMO_INCIDENT_RED = '#e5484d'
const RING_POINTS = 48

export function demoIncidentFeatures(incidents: SimulatedIncident[], avoidRadiusM: number): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []
  for (const i of incidents) {
    const ring = Array.from({ length: RING_POINTS + 1 }, (_, k) => {
      const a = (2 * Math.PI * k) / RING_POINTS
      return fromLocal(i.lngLat, avoidRadiusM * Math.cos(a), avoidRadiusM * Math.sin(a))
    })
    features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { kind: 'zone', id: i.id } })
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: i.lngLat }, properties: { kind: 'pin', id: i.id, category: i.category } })
  }
  return { type: 'FeatureCollection', features }
}
