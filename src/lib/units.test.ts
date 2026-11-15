import { describe, expect, it } from 'vitest'
import { distanceSpoken, distanceText, durationText } from './units'

const ft = (n: number) => n / 3.28084
const mi = (n: number) => n * 1609.344

describe('distanceText', () => {
  it('uses feet under a tenth of a mile, rounded to 10 then 50', () => {
    expect(distanceText(0)).toBe('10 ft')
    expect(distanceText(ft(34))).toBe('30 ft')
    expect(distanceText(ft(96))).toBe('100 ft')
    expect(distanceText(ft(487))).toBe('500 ft')
    expect(distanceText(ft(520))).toBe('500 ft')
  })

  it('switches to tenths of a mile, then whole miles from 10', () => {
    expect(distanceText(ft(527))).toBe('0.1 mi')
    expect(distanceText(mi(0.3))).toBe('0.3 mi')
    expect(distanceText(mi(2.44))).toBe('2.4 mi')
    expect(distanceText(mi(12.6))).toBe('13 mi')
  })

  it('has a spoken form', () => {
    expect(distanceSpoken(ft(500))).toBe('500 feet')
    expect(distanceSpoken(mi(0.3))).toBe('0.3 miles')
    expect(distanceSpoken(mi(1))).toBe('1 mile')
  })
})

describe('durationText', () => {
  it('rounds to minutes, never zero, and rolls into hours', () => {
    expect(durationText(5)).toBe('1 min')
    expect(durationText(8 * 60 + 29)).toBe('8 min')
    expect(durationText(3600)).toBe('1 hr')
    expect(durationText(3600 + 5 * 60)).toBe('1 hr 5 min')
  })
})
