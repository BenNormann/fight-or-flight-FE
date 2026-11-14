/**
 * The one risk scale. Hexes, route segments, legend and chips all read from here.
 * Never signal risk by color alone: always pair `color` with `label` (or an icon).
 */
export interface RiskBand {
  level: 1 | 2 | 3 | 4 | 5
  /** Upper bound of the band (inclusive), score 0..1. */
  max: number
  label: string
  /** CSS variable defined in src/styles/tokens.css. */
  cssVar: `--risk-${1 | 2 | 3 | 4 | 5}`
}

export const riskBands: readonly RiskBand[] = [
  { level: 1, max: 0.2, label: 'Very low', cssVar: '--risk-1' },
  { level: 2, max: 0.4, label: 'Low', cssVar: '--risk-2' },
  { level: 3, max: 0.6, label: 'Moderate', cssVar: '--risk-3' },
  { level: 4, max: 0.8, label: 'High', cssVar: '--risk-4' },
  { level: 5, max: 1, label: 'Very high', cssVar: '--risk-5' },
]

export function riskBand(score: number): RiskBand {
  const s = Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0
  return riskBands.find((b) => s <= b.max) ?? riskBands[riskBands.length - 1]!
}

export const riskLabel = (score: number) => riskBand(score).label

/** For DOM/CSS use. Map layers resolve the variable to RGBA once per theme. */
export const riskColor = (score: number) => `var(${riskBand(score).cssVar})`
