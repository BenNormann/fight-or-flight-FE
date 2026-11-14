import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export async function startMocks() {
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledFrame: 'bypass',
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    quiet: true,
  })
}
