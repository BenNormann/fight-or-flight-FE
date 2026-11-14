import { createBrowserRouter } from 'react-router'
import { Shell } from './Shell'

/**
 * Four routes, one shell. Routes only set selection (P2); the map never unmounts.
 * Events, layers and settings are sheet states, not routes.
 */
export const router = createBrowserRouter([
  {
    element: <Shell />,
    children: [
      { path: '/', element: null },
      { path: '/b/:buildingId', element: null },
      { path: '/r/:roomId', element: null },
      { path: '/route', element: null },
      { path: '*', element: null },
    ],
  },
])
