import { create } from 'zustand'
import { env } from '@/lib/env'
import type { PositionSourceId } from '@/lib/nav'

export const SIM_RATES = [1, 4, 16] as const
export type SimRate = (typeof SIM_RATES)[number]

/** Development settings for the navigation driver. Not persisted; not part of the app store. */
interface NavDriverSettings {
  /** Simulated walk while routes are sample data; the phone's GPS to try it outside. */
  source: PositionSourceId
  paused: boolean
  rate: SimRate
  /** Simulated walk only: metres beside the route, to try rerouting. 0 = on the route. */
  sidestepM: number
  setSource: (source: PositionSourceId) => void
  setPaused: (paused: boolean) => void
  setRate: (rate: SimRate) => void
  setSidestep: (m: number) => void
}

/** How far "Stray" walks the simulator off the route: well past the off-route threshold. */
export const SIM_SIDESTEP_M = 60

export const useNavDriverSettings = create<NavDriverSettings>()((set) => ({
  // Sample routes are walked for you; real routes follow the phone.
  source: env.useMocks ? 'simulated' : 'device',
  paused: false,
  rate: 1,
  sidestepM: 0,
  setSource: (source) => set({ source }),
  setPaused: (paused) => set({ paused }),
  setRate: (rate) => set({ rate }),
  setSidestep: (sidestepM) => set({ sidestepM }),
}))
