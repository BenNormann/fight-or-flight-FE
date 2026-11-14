import { createBrowserRouter } from 'react-router'
import { Shell } from './Shell'
import { DirectionsFromUrl, HomeFromUrl, SelectFromUrl } from './UrlRoutes'

/**
 * Four routes, one shell. Routes only set selection; the map never unmounts.
 * Events, layers, search and safety are sheet states at `/`, not routes.
 */
export const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: <HomeFromUrl /> },
      { path: '/b/:buildingId', element: <SelectFromUrl kind="building" /> },
      { path: '/r/:roomId', element: <SelectFromUrl kind="room" /> },
      { path: '/route', element: <DirectionsFromUrl /> },
      { path: '*', element: null },
    ],
  },
])
