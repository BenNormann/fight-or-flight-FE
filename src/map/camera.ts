import type { MapMode } from '@/domain'

/** Three camera presets on one map. There is no separate isometric renderer. */
export const cameraPresets: Record<MapMode, { pitch: number; bearing: number }> = {
  '2d': { pitch: 0, bearing: 0 },
  iso: { pitch: 55, bearing: -20 },
  '3d': { pitch: 60, bearing: -20 },
}
