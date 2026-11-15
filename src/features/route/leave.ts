/** Leave-time presets. The store keeps only the ISO time, so we remember which preset produced it. */
export const LEAVE_OPTIONS = [
  { id: 'now', label: 'Leave now', minutes: 0 },
  { id: '15', label: 'In 15 min', minutes: 15 },
  { id: '30', label: 'In 30 min', minutes: 30 },
  { id: '60', label: 'In 1 hour', minutes: 60 },
] as const

export type LeaveOptionId = (typeof LEAVE_OPTIONS)[number]['id'] | 'custom'

const presetByIso = new Map<string, LeaveOptionId>()

export function leaveIso(minutes: number, now = Date.now()): string | null {
  if (!minutes) return null
  const d = new Date(now + minutes * 60_000)
  d.setSeconds(0, 0)
  return d.toISOString()
}

export function rememberLeaveOption(iso: string | null, id: LeaveOptionId) {
  if (iso) presetByIso.set(iso, id)
}

/** Which chip is pressed for a stored leave time: no time is "now", an unknown time is "custom". */
export function leaveOptionFor(leaveAt: string | null): LeaveOptionId {
  if (!leaveAt) return 'now'
  return presetByIso.get(leaveAt) ?? 'custom'
}
