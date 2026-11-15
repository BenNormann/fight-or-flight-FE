/**
 * The one clock format for the app: 12-hour, US locale ("6:30 PM", "2 AM").
 * Minutes are dropped on the hour only for opening-hours text (`formatHour`).
 */
const clock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const hourOnly = new Intl.DateTimeFormat('en-US', { hour: 'numeric' })

/** "6:30 PM" for an ISO string or Date. */
export function formatTime(value: string | Date): string {
  return clock.format(typeof value === 'string' ? new Date(value) : value)
}

/** Wall-clock hour and minute (24h input) as "2 AM" or "11:30 PM". */
export function formatHour(hour: number, minute = 0): string {
  const d = new Date(2000, 0, 1, hour, minute)
  return minute ? clock.format(d) : hourOnly.format(d)
}
