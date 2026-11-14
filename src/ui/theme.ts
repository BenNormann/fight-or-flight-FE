import { useEffect, useSyncExternalStore } from 'react'

/**
 * Theme: `auto` follows the clock (night 18:00–06:00, the main use case),
 * or the user pins light or dark. Applies `.dark` on <html>.
 */
export type ThemeMode = 'auto' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_MODES: readonly ThemeMode[] = ['auto', 'light', 'dark']
const STORAGE_KEY = 'fof.theme'

export const NIGHT_STARTS_AT = 18
export const NIGHT_ENDS_AT = 6

export function isNight(at: Date): boolean {
  const h = at.getHours()
  return h >= NIGHT_STARTS_AT || h < NIGHT_ENDS_AT
}

export function resolveTheme(mode: ThemeMode, at: Date): ResolvedTheme {
  if (mode === 'auto') return isNight(at) ? 'dark' : 'light'
  return mode
}

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  return THEME_MODES[(THEME_MODES.indexOf(mode) + 1) % THEME_MODES.length] ?? 'auto'
}

function readStored(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

let mode: ThemeMode = typeof window === 'undefined' ? 'auto' : readStored()
let resolved: ResolvedTheme = resolveTheme(mode, new Date())
const listeners = new Set<() => void>()

function apply() {
  resolved = resolveTheme(mode, new Date())
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  const bg = getComputedStyle(root).getPropertyValue('--background').trim()
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}

function emit() {
  apply()
  listeners.forEach((l) => l())
}

export function setThemeMode(next: ThemeMode) {
  mode = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // Storage blocked: the choice lasts for this session only.
  }
  emit()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Call once at the app root: applies the theme and re-checks the clock each minute. */
export function useThemeController() {
  useEffect(() => {
    emit()
    const id = window.setInterval(() => {
      if (mode !== 'auto') return
      const before = resolved
      apply()
      if (resolved !== before) listeners.forEach((l) => l())
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])
}

export function useTheme() {
  const m = useSyncExternalStore(subscribe, () => mode, () => 'auto' as ThemeMode)
  const r = useSyncExternalStore(subscribe, () => resolved, () => 'dark' as ResolvedTheme)
  return { mode: m, resolved: r, setMode: setThemeMode }
}
