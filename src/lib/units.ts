/**
 * US display units, rounded the way car navigation reads them out. Pure.
 * Distances arrive in metres (domain types are metric); only the text is imperial.
 */

const FT_PER_M = 3.28084
const M_PER_MI = 1609.344
/** Below a tenth of a mile, talk in feet. */
const FEET_BELOW_MI = 0.1

/**
 * "30 ft", "500 ft", "0.3 mi", "2.4 mi", "12 mi".
 * Feet round to 10 under 100 ft and to 50 above, so the figure does not flicker as you walk.
 */
export function distanceText(metres: number): string {
  const m = Math.max(0, metres)
  const mi = m / M_PER_MI
  if (mi < FEET_BELOW_MI) {
    const ft = m * FT_PER_M
    const step = ft < 100 ? 10 : 50
    const rounded = Math.round(ft / step) * step
    // Rounding up past a tenth of a mile (528 ft) reads as miles.
    return rounded >= FEET_BELOW_MI * 5280 ? '0.1 mi' : `${Math.max(10, rounded)} ft`
  }
  if (mi < 10) return `${mi.toFixed(1)} mi`
  return `${Math.round(mi)} mi`
}

/** "1 min", "12 min", "1 hr 5 min", "2 hr". Never "0 min". */
export function durationText(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
}

/** Spoken form for screen readers: "500 feet", "0.3 miles". */
export function distanceSpoken(metres: number): string {
  return distanceText(metres).replace(/ ft$/, ' feet').replace(/^1\.0 mi$/, '1 mile').replace(/ mi$/, ' miles')
}
