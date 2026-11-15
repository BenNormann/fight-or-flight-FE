import { describe, expect, it } from 'vitest'
import { climbText, floorName } from './floors'

describe('floors', () => {
  it('names a floor from its label, then from its number', () => {
    expect(floorName({ floor: 2, floorLabel: '2' })).toBe('Floor 2')
    expect(floorName({ floor: -1, floorLabel: 'B' })).toBe('Basement (B)')
    expect(floorName({ floor: -1, floorLabel: 'LL' })).toBe('Lower level (LL)')
    expect(floorName({ floor: 3 })).toBe('Floor 3')
    expect(floorName({ floor: 0 })).toBe('Ground level')
    expect(floorName({ floor: null })).toBeNull()
  })
  it('counts storeys from the entrance floor', () => {
    expect(climbText(1)).toBeNull()
    expect(climbText(3)).toBe('Up 2 floors')
    expect(climbText(2)).toBe('Up 1 floor')
    expect(climbText(0)).toBe('Down 1 floor')
    expect(climbText(-1)).toBe('Down 2 floors')
  })
})
