import { describe, expect, it } from 'vitest'
import { leaveIso, leaveOptionFor, rememberLeaveOption } from './leave'

describe('leave time chips', () => {
  it('no leave time means leave now', () => {
    expect(leaveIso(0)).toBeNull()
    expect(leaveOptionFor(null)).toBe('now')
  })

  it('a preset survives a remount because it is derived from the stored time', () => {
    const iso = leaveIso(15, Date.UTC(2026, 10, 14, 18, 0, 30))!
    expect(iso).toBe('2026-11-14T18:15:00.000Z')
    rememberLeaveOption(iso, '15')
    expect(leaveOptionFor(iso)).toBe('15')
  })

  it('a time no preset produced is custom', () => {
    expect(leaveOptionFor('2026-11-14T21:40:00.000Z')).toBe('custom')
  })
})
