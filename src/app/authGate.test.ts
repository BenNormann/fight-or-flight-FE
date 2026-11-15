import { describe, expect, it } from 'vitest'
import { LIVE_LOCATION_INTERVAL_MS, metresBetween, shouldPostFix } from '@/api/queries'
import { gateFor, isLoginPath, requiresSignIn } from './authGate'

describe('directions gate', () => {
  it('gates only directions paths', () => {
    expect(requiresSignIn('/route')).toBe(true)
    expect(requiresSignIn('/route?to=b-lib')).toBe(true)
    expect(requiresSignIn('/routes')).toBe(false)
    expect(requiresSignIn('/b/b-lib')).toBe(false)
    expect(requiresSignIn('/')).toBe(false)
  })

  it('sends signed-out users to sign-in, waits while loading, allows otherwise', () => {
    expect(gateFor('/route?to=x', 'signedOut')).toBe('login')
    expect(gateFor('/route?to=x', 'pending')).toBe('wait')
    expect(gateFor('/route?to=x', 'signedIn')).toBe('allow')
    expect(gateFor('/b/x', 'signedOut')).toBe('allow')
    expect(gateFor('/', 'pending')).toBe('allow')
  })

  it('never gates when the backend serves no auth', () => {
    expect(gateFor('/route', 'off')).toBe('allow')
  })

  it('recognises the login pages', () => {
    expect(isLoginPath('/login')).toBe(true)
    expect(isLoginPath('/login/dev')).toBe(true)
    expect(isLoginPath('/loginx')).toBe(false)
  })
})

describe('live location throttle', () => {
  const here: [number, number] = [-118.285, 34.022]
  const near: [number, number] = [-118.28502, 34.02201] // ~2 m
  const far: [number, number] = [-118.285, 34.0222] // ~22 m

  it('posts the first fix', () => {
    expect(shouldPostFix(null, 0, here)).toBe(true)
  })

  it('waits the interval, then posts only after a meaningful move', () => {
    const last = { at: 0, lngLat: here }
    expect(shouldPostFix(last, LIVE_LOCATION_INTERVAL_MS - 1, far)).toBe(false)
    expect(shouldPostFix(last, LIVE_LOCATION_INTERVAL_MS, near)).toBe(false)
    expect(shouldPostFix(last, LIVE_LOCATION_INTERVAL_MS, far)).toBe(true)
  })

  it('posts every 10 seconds', () => {
    expect(LIVE_LOCATION_INTERVAL_MS).toBe(10_000)
    expect(metresBetween(here, far)).toBeGreaterThan(20)
  })
})
