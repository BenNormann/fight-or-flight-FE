import { describe, expect, it } from 'vitest'
import { isNight, nextThemeMode, resolveTheme } from './theme'

const at = (h: number, m = 0) => new Date(2026, 10, 14, h, m)

describe('theme', () => {
  it('treats 18:00 to 05:59 as night', () => {
    expect(isNight(at(17, 59))).toBe(false)
    expect(isNight(at(18))).toBe(true)
    expect(isNight(at(0))).toBe(true)
    expect(isNight(at(5, 59))).toBe(true)
    expect(isNight(at(6))).toBe(false)
  })

  it('auto follows the clock, manual modes win', () => {
    expect(resolveTheme('auto', at(22))).toBe('dark')
    expect(resolveTheme('auto', at(12))).toBe('light')
    expect(resolveTheme('light', at(22))).toBe('light')
    expect(resolveTheme('dark', at(12))).toBe('dark')
  })

  it('cycles auto → light → dark → auto', () => {
    expect(nextThemeMode('auto')).toBe('light')
    expect(nextThemeMode('light')).toBe('dark')
    expect(nextThemeMode('dark')).toBe('auto')
  })
})
