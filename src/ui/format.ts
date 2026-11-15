/** Display formatting for dates. Pure. Distances and durations (US units) live in `@/lib/units`. */

/** "Tonight", "Tomorrow", or a weekday, relative to `now`. */
export function dayLabel(iso: string, now = new Date(), locale?: string): string {
  const d = new Date(iso)
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOf(d) - startOf(now)) / 86_400_000)
  if (days <= 0) return d.getHours() >= 17 ? 'Tonight' : 'Today'
  if (days === 1) return 'Tomorrow'
  return d.toLocaleDateString(locale, { weekday: 'long' })
}

export function arrivalTime(durationS: number, leaveAt: string | null, now = new Date()): Date {
  const start = leaveAt ? new Date(leaveAt) : now
  return new Date(start.getTime() + durationS * 1000)
}
