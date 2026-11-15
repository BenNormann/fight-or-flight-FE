import { createBrowserRouter } from 'react-router'
import { Shell } from './Shell'
import { DirectionsFromUrl, HomeFromUrl, SelectFromUrl } from './UrlRoutes'

/**
 * Four map routes plus sign-in, one shell. Routes only set selection; the map never unmounts.
 * Events, layers, search and safety are sheet states at `/`, not routes.
 */
export const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <HomeFromUrl /> },
      { path: '/b/:buildingId', element: <SelectFromUrl kind="building" /> },
      { path: '/r/:roomId', element: <SelectFromUrl kind="room" /> },
      { path: '/p/:placeId', element: <SelectFromUrl kind="place" /> },
      { path: '/route', element: <DirectionsFromUrl /> },
      // Sign-in pages cover the shell; the map stays mounted underneath.
      // Lazy: sign-in is off the first-paint path.
      { path: '/login', lazy: async () => ({ Component: (await import('./LoginPage')).LoginPage }) },
      { path: '/login/dev', lazy: async () => ({ Component: (await import('./LoginPage')).DevSignInPage }) },
      { path: '*', element: null },
    ],
  },
])
