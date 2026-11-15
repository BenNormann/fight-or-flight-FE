import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        // Registered by hand in src/main.tsx: it must not fight the MSW worker in mock mode.
        injectRegister: false,
        includeAssets: ['icon.svg'],
        manifest: {
          name: 'Odyssey',
          short_name: 'Odyssey',
          description: 'USC campus map with safe walking directions',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#0b0d10',
          theme_color: '#0b0d10',
          icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,woff2}'],
          globIgnores: ['mockServiceWorker.js', '**/browser-*.js'],
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      // Dev: /api is forwarded to the backend, so there is no CORS locally.
      proxy: {
        '/api': { target: env.VITE_API_URL || 'http://localhost:5000', changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  }
})
