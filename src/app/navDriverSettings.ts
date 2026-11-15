import { create } from 'zustand'
import type { PositionSourceId } from '@/lib/nav'

export const SIM_RATES = [1, 4, 16] as const
export type SimRate = (typeof SIM_RATES)[number]

/** Development settings for the navigation driver. Not persisted; not part of the app store. */
interface NavDriverSettings {
  /** Simulated walk while routes are sample data; the phone's GPS to try it outside. */
  source: PositionSourceId
  paused: boolean
  rate: SimRate
  setSource: (source: PositionSourceId) => void
  setPaused: (paused: boolean) => void
  setRate: (rate: SimRate) => void
}

export const useNavDriverSettings = create<NavDriverSettings>()((set) => ({
  source: 'simulated',
  paused: false,
  rate: 1,
  setSource: (source) => set({ source }),
  setPaused: (paused) => set({ paused }),
  setRate: (rate) => set({ rate }),
}))
