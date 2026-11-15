import { describe, expect, it } from 'vitest'
import { formatHour, formatTime } from './time'

const norm = (s: string) => s.replace(/\s/g, ' ')

describe('time formatting', () => {
  it('formats instants as 12-hour US time', () => {
    expect(norm(formatTime(new Date(2026, 10, 14, 18, 30)))).toBe('6:30 PM')
    expect(norm(formatTime(new Date(2026, 10, 14, 9, 5)))).toBe('9:05 AM')
  })
  it('formats wall-clock hours, dropping :00', () => {
    expect(norm(formatHour(2))).toBe('2 AM')
    expect(norm(formatHour(22))).toBe('10 PM')
    expect(norm(formatHour(23, 30))).toBe('11:30 PM')
    expect(norm(formatHour(0))).toBe('12 AM')
  })
})
