import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { env } from '@/lib/env'
import '@/styles/index.css'

async function boot() {
  if (env.useMocks) {
    const { startMocks } = await import('@/api/mocks/browser')
    await startMocks()
  } else if (import.meta.env.PROD) {
    // Offline support. Skipped in mock mode: MSW owns the service worker scope there.
    const { registerSW } = await import('virtual:pwa-register')
    registerSW({ immediate: true })
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
