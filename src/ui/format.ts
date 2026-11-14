/** Display formatting for numeric UI. Pure; shown in Geist Mono via `font-mono`. */

export function formatDuration(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

/** Metric under 1 km, then km with one decimal. */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`
  return `${(metres / 1000).toFixed(1)} km`
}

export function formatClock(iso: string | Date, locale?: string): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
}

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
