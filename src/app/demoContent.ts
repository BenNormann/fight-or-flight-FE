/**
 * Every piece of sample copy the shell shows before real data exists.
 * Replace or delete entries as features land; nothing here is backend data.
 */
import type { MapMode } from '@/domain'
import type { ThemeMode } from '@/ui'

export const demo = {
  search: {
    placeholder: 'Search buildings, rooms, places',
  },

  sheet: {
    title: 'Where to?',
    subtitle: 'Search or tap the map to see how safe a place is right now.',
    suggestions: [
      { id: 'walk', label: 'Safe walk home' },
      { id: 'exits', label: 'Nearest exit' },
      { id: 'open', label: 'Open now' },
      { id: 'events', label: 'Events tonight' },
    ],
    emptyTitle: 'Nothing nearby yet',
    emptyBody: 'Places and live safety info will show here once the map is connected.',
    appearance: 'Appearance',
  },

  mapModes: [
    { value: '2d', label: '2D' },
    { value: 'iso', label: 'Iso' },
    { value: '3d', label: '3D' },
  ] satisfies { value: MapMode; label: string }[],

  themeModes: [
    { value: 'auto', label: 'Auto' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ] satisfies { value: ThemeMode; label: string }[],

  themeHint: 'Auto switches to dark from 18:00 to 06:00.',

  toasts: {
    search: { title: 'Search isn’t connected yet', description: 'Results will appear here once the backend serves them.' },
    safety: {
      title: 'Emergency help isn’t connected yet',
      description: 'If you are in danger, call 911 now.',
    },
    locate: { title: 'Location isn’t available yet', description: 'Showing a preview map.' },
    layers: { title: 'Map layers aren’t available yet', description: 'They’ll appear when live data is connected.' },
    suggestion: { title: 'Coming soon', description: 'This shortcut needs live data.' },
    theme: (mode: ThemeMode) => ({
      title: `Theme: ${mode === 'auto' ? 'Auto' : mode === 'light' ? 'Light' : 'Dark'}`,
      description: mode === 'auto' ? 'Dark from 18:00 to 06:00.' : undefined,
    }),
  },

  a11y: {
    safety: 'Emergency help',
    safetyText: 'SOS',
    locate: 'Show my location',
    layers: 'Map layers',
    mapMode: 'Map view',
    theme: (mode: ThemeMode) => `Theme: ${mode}. Tap to change.`,
  },
} as const
