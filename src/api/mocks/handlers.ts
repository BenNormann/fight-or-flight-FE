/**
 * Mock backend. Mirrors docs/BACKEND_CONTRACT.md exactly; one handler per endpoint.
 * Fixtures are raw BACKEND shapes (they go through the adapters like real responses).
 */
import { http, HttpResponse } from 'msw'
import config from './fixtures/config.json'

export const handlers = [http.get('*/api/config', () => HttpResponse.json(config))]
