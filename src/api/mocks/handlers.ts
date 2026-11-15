/**
 * Mock backend. Mirrors docs/BACKEND_CONTRACT.md exactly; one handler per endpoint.
 * Fixtures are raw BACKEND shapes (they go through the adapters like real responses).
 */
import { http, HttpResponse } from 'msw'
import { AUTH_PATHS, isAllowedEmail } from '@/api/adapters/auth'
import { LOCATION_PATH, locationBody } from '@/api/adapters/location'
import config from './fixtures/config.json'
import { DEV_SIGN_IN_PATH, DEV_USER_EMAIL, clearMockSession, readMockSession, writeMockSession } from './session'

const unauthorized = () => HttpResponse.json({ message: 'Not signed in' }, { status: 401 })

export const handlers = [
  http.get('*/api/config', () => HttpResponse.json(config)),

  // Auth (proposed contract). The session lives in sessionStorage instead of a cookie.
  http.get(`*${AUTH_PATHS.me}`, () => {
    const user = readMockSession()
    return user ? HttpResponse.json(user) : unauthorized()
  }),
  http.post(`*${AUTH_PATHS.logout}`, () => {
    clearMockSession()
    return new HttpResponse(null, { status: 204 })
  }),
  // Mock only: what the provider + callback would do for real.
  http.post(`*${DEV_SIGN_IN_PATH}`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { email?: string }
    const email = body?.email?.trim() || DEV_USER_EMAIL
    // Same rule the real backend applies: USC accounts only.
    if (!isAllowedEmail(email)) return HttpResponse.json({ error: 'domain' }, { status: 403 })
    return HttpResponse.json(writeMockSession(email))
  }),

  http.post(`*${LOCATION_PATH}`, async ({ request }) => {
    if (!readMockSession()) return unauthorized()
    // Strict schema: a body that still carries direction (`heading_deg`) is rejected.
    const parsed = locationBody.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return HttpResponse.json({ message: 'Invalid location' }, { status: 400 })
    return new HttpResponse(null, { status: 204 })
  }),
]
