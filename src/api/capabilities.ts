/**
 * Capabilities: what the backend actually serves. Features and layers gate on these
 * and hide themselves instead of rendering broken screens.
 *
 * Sources, in order: the config endpoint's feature list, then runtime evidence
 * (an endpoint answering 404/405/501 switches its capability off for the session).
 */
import { useSyncExternalStore } from 'react'
import { CAPABILITY_KEYS, type AppConfig, type Capabilities, type CapabilityKey } from '@/domain'
import { useAppConfig } from './queries'

export const NO_CAPABILITIES = Object.freeze(
  Object.fromEntries(CAPABILITY_KEYS.map((k) => [k, false])),
) as Capabilities

const unavailable = new Set<CapabilityKey>()
const listeners = new Set<() => void>()
let version = 0

/** Call from a query's error path when `ApiError.notServed` is true. */
export function markUnavailable(key: CapabilityKey) {
  if (unavailable.has(key)) return
  unavailable.add(key)
  version++
  listeners.forEach((l) => l())
}

export function resolveCapabilities(config: AppConfig | undefined, off: ReadonlySet<CapabilityKey> = unavailable): Capabilities {
  if (!config) return NO_CAPABILITIES
  return Object.fromEntries(CAPABILITY_KEYS.map((k) => [k, config.capabilities[k] && !off.has(k)])) as Capabilities
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useCapabilities(): Capabilities {
  const { data } = useAppConfig()
  useSyncExternalStore(subscribe, () => version)
  return resolveCapabilities(data)
}

export const useCapability = (key: CapabilityKey) => useCapabilities()[key]
