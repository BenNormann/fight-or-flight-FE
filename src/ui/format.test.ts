import { describe, expect, it } from 'vitest'
import { arrivalTime, dayLabel } from './format'

describe('format', () => {
  it('day labels are relative', () => {
    const now = new Date(2026, 10, 14, 12)
    expect(dayLabel(new Date(2026, 10, 14, 20).toISOString(), now)).toBe('Tonight')
    expect(dayLabel(new Date(2026, 10, 14, 13).toISOString(), now)).toBe('Today')
    expect(dayLabel(new Date(2026, 10, 15, 9).toISOString(), now)).toBe('Tomorrow')
  })

  it('arrival adds duration to leave time', () => {
    const now = new Date(2026, 10, 14, 12)
    expect(arrivalTime(600, null, now).getMinutes()).toBe(10)
    expect(arrivalTime(600, new Date(2026, 10, 14, 13).toISOString(), now).getHours()).toBe(13)
  })
})
