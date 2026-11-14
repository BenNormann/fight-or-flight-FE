import { describe, expect, it } from 'vitest'
import { riskBand, riskBands, riskColor, riskLabel } from './risk'

describe('risk scale', () => {
  it('maps scores to five ordered bands', () => {
    expect(riskBands).toHaveLength(5)
    expect(riskBand(0).level).toBe(1)
    expect(riskBand(0.2).level).toBe(1)
    expect(riskBand(0.21).level).toBe(2)
    expect(riskBand(0.5).level).toBe(3)
    expect(riskBand(1).level).toBe(5)
  })

  it('clamps out-of-range and invalid scores', () => {
    expect(riskBand(-1).level).toBe(1)
    expect(riskBand(7).level).toBe(5)
    expect(riskBand(Number.NaN).level).toBe(1)
  })

  it('always offers a label alongside the color', () => {
    expect(riskLabel(0.9)).toBe('Very high')
    expect(riskColor(0.9)).toBe('var(--risk-5)')
  })
})
