import { afterEach, describe, expect, it, vi } from 'vitest'
import userFixture from '@/api/mocks/fixtures/user.json'
import { ApiError } from '@/api/client'
import { AUTH_PATHS, buildLoginUrl, fetchMe, isAllowedEmail, loginErrorMessage, loginRoute, parseUser, safeNext } from './auth'

const ORIGIN = 'https://map.example.test'

describe('auth adapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('converts the user fixture, dropping null optionals', () => {
    expect(parseUser(userFixture)).toEqual({ id: 'dev-user-1', email: 'trojan.dev@usc.edu', name: 'Development user' })
  })

  it('reads the backend /me shape (Google sub as id, null picture)', () => {
    expect(parseUser({ id: '1098', email: 'tommy@usc.edu', name: 'Tommy Trojan', picture: null })).toEqual({
      id: '1098',
      email: 'tommy@usc.edu',
      name: 'Tommy Trojan',
    })
  })

  it('accepts numeric ids and extra fields; rejects a user without email', () => {
    expect(parseUser({ id: 7, email: 'a@b.c', role: 'x' })).toEqual({ id: '7', email: 'a@b.c' })
    expect(() => parseUser({ id: 'x' })).toThrow()
  })

  it('treats 401 from /me as signed out and sends cookies', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchMe()).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(AUTH_PATHS.me), expect.objectContaining({ credentials: 'include' }))
  })

  it('returns the user on 200 and rethrows other errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(userFixture)))
    await expect(fetchMe()).resolves.toMatchObject({ email: 'trojan.dev@usc.edu' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    await expect(fetchMe()).rejects.toBeInstanceOf(ApiError)
  })
})

describe('safeNext', () => {
  it('keeps same-origin paths with query and hash', () => {
    expect(safeNext('/route?to=b-lib', ORIGIN)).toBe('/route?to=b-lib')
    expect(safeNext(`${ORIGIN}/b/x#top`, ORIGIN)).toBe('/b/x#top')
  })

  it.each([
    ['empty', ''],
    ['missing', null],
    ['other origin', 'https://evil.test/route'],
    ['protocol relative', '//evil.test/route'],
    ['backslash', '/\\evil.test'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,hi'],
    ['the login page (loop)', '/login?next=/route'],
    ['the dev sign-in page', '/login/dev'],
  ])('falls back to / for %s', (_, raw) => {
    expect(safeNext(raw, ORIGIN)).toBe('/')
  })
})

describe('login URLs', () => {
  it('builds /login?next= for an in-app path', () => {
    expect(loginRoute('/route?to=b 1')).toBe('/login?next=%2Froute%3Fto%3Db%201')
  })

  it('real mode: backend login endpoint with an absolute same-origin next', () => {
    const url = buildLoginUrl('/route?to=b-lib', ORIGIN, false)
    const parsed = new URL(url, ORIGIN)
    expect(parsed.pathname).toBe(AUTH_PATHS.login)
    expect(parsed.searchParams.get('next')).toBe(`${ORIGIN}/route?to=b-lib`)
  })

  it('never forwards a foreign next', () => {
    const parsed = new URL(buildLoginUrl('https://evil.test', ORIGIN, false), ORIGIN)
    expect(parsed.searchParams.get('next')).toBe(`${ORIGIN}/`)
  })

  it('mock mode: the in-app development stand-in', () => {
    expect(buildLoginUrl('/route', ORIGIN, true)).toBe('/login/dev?next=%2Froute')
  })
})

describe('USC only', () => {
  it('accepts @usc.edu addresses, case and whitespace insensitive', () => {
    expect(isAllowedEmail('trojan@usc.edu')).toBe(true)
    expect(isAllowedEmail('  Trojan@USC.EDU ')).toBe(true)
  })

  it.each(['trojan@gmail.com', 'trojan@usc.edu.evil.test', 'trojan@notusc.edu', 'trojan@alumni.usc.edu', 'usc.edu', '@usc.edu', 'a@b@usc.edu'])(
    'rejects %s',
    (email) => expect(isAllowedEmail(email)).toBe(false),
  )

  it('turns ?error= codes into readable sentences without echoing unknown codes', () => {
    expect(loginErrorMessage(null)).toBeNull()
    expect(loginErrorMessage('domain')).toMatch(/USC email/)
    expect(loginErrorMessage('<script>')).toBe('Sign in did not finish. Try again.')
    expect(loginErrorMessage('unavailable')).toMatch(/not available/)
  })
})
