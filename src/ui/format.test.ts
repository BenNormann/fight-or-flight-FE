import { describe, expect, it } from 'vitest'
import { arrivalTime, dayLabel, formatDistance, formatDuration } from './format'

describe('format', () => {
  it('durations round to minutes and roll into hours', () => {
    expect(formatDuration(20)).toBe('1 min')
    expect(formatDuration(8 * 60 + 29)).toBe('8 min')
    expect(formatDuration(3600)).toBe('1 h')
    expect(formatDuration(3600 + 25 * 60)).toBe('1 h 25 min')
  })

  it('distances switch to km at 1000 m', () => {
    expect(formatDistance(643)).toBe('640 m')
    expect(formatDistance(1530)).toBe('1.5 km')
  })

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
