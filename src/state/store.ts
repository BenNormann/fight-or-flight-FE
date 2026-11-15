import { create } from 'zustand'
import type { Id, IsoTime, MapMode, NavCharacterId, NavProgress, RouteKind, Selection, SheetSnap } from '@/domain'

/** Which view the sheet (mobile) or side panel (desktop) shows. One feature folder each. */
export type PanelView = 'explore' | 'search' | 'place' | 'directions' | 'navigation' | 'events' | 'layers' | 'safety'
export type TravelMode = 'walk' | 'bike' | 'ride'
/** One end of a trip. */
export type TripEnd = 'origin' | 'destination'

/** The one UI store. Server data lives in TanStack Query; shareable state lives in the URL. */
export interface AppState {
  mapMode: MapMode
  selection: Selection | null
  view: PanelView
  sheetSnap: SheetSnap
  /** Desktop side panel. */
  panelOpen: boolean
  query: string
  /** Category chip id, or null. */
  category: string | null
  /** null = leave now. */
  leaveAt: IsoTime | null
  travelMode: TravelMode
  routeKind: RouteKind
  /** Where directions start: an entity or pin id, or null for the user's own location. */
  origin: Id | null
  /** Destination for directions (an entity or pin id). */
  destination: Id | null
  /** Map layers was opened over the directions view: the planned route stays on the map and closing layers returns to it. */
  layersOverDirections: boolean
  /** The next tap on the map sets this end of the trip. */
  picking: TripEnd | null
  /** A started route; drives the active route pill. */
  activeRouteId: Id | null
  /** Layer ids the user toggled, overriding each LayerDef.defaultOn. */
  layerOverrides: Record<string, boolean>
  /** The user opted in to sharing live location while signed in. Off by default; not persisted. */
  liveLocationOptIn: boolean
  /** Live progress along the started route; null when no route is active. Written by the navigation driver only. */
  nav: NavProgress | null
  /** Camera follows the traveller. Panning the map turns it off; the recenter control turns it on. */
  navFollowing: boolean
  /** The user turned or tilted the map while following: position still follows, but not heading-up. */
  navAimFree: boolean
  navCharacter: NavCharacterId

  setMapMode: (mode: MapMode) => void
  /** Selecting an entity opens its view at half; clearing returns to explore at peek. */
  select: (selection: Selection | null) => void
  openView: (view: PanelView) => void
  setSheetSnap: (snap: SheetSnap) => void
  setPanelOpen: (open: boolean) => void
  search: (query: string, category?: string | null) => void
  directionsTo: (destination: Id | null) => void
  /** Set one end of the trip (origin null = your location) and show directions. */
  setTripEnd: (end: TripEnd, id: Id | null) => void
  swapTripEnds: () => void
  setPicking: (end: TripEnd | null) => void
  setTravelMode: (mode: TravelMode) => void
  setRouteKind: (kind: RouteKind) => void
  startRoute: (routeId: Id) => void
  endRoute: () => void
  setLeaveAt: (at: IsoTime | null) => void
  toggleLayer: (id: string, on: boolean) => void
  setLiveLocationOptIn: (on: boolean) => void
  setNav: (nav: NavProgress | null) => void
  setNavFollowing: (following: boolean) => void
  setNavAimFree: (free: boolean) => void
  setNavCharacter: (id: NavCharacterId) => void
  /** Back one level: detail → explore. */
  back: () => void
}

const viewFor = (s: Selection): PanelView =>
  s.kind === 'route' ? 'directions' : s.kind === 'event' ? 'events' : s.kind === 'riskCell' ? 'safety' : 'place'

/** The resting view: the trip while a route is started, otherwise explore. */
const homeView = (s: Pick<AppState, 'activeRouteId'>): PanelView => (s.activeRouteId ? 'navigation' : 'explore')

/** Fields that end a started route. */
const ended = { activeRouteId: null, nav: null, navFollowing: true, navAimFree: false } as const

export const useAppStore = create<AppState>()((set) => ({
  mapMode: '2d',
  selection: null,
  view: 'explore',
  sheetSnap: 'peek',
  panelOpen: true,
  query: '',
  category: null,
  leaveAt: null,
  travelMode: 'walk',
  routeKind: 'safest',
  origin: null,
  destination: null,
  picking: null,
  layersOverDirections: false,
  activeRouteId: null,
  layerOverrides: {},
  liveLocationOptIn: false,
  nav: null,
  navFollowing: true,
  navAimFree: false,
  navCharacter: 'chevron',

  setMapMode: (mapMode) => set({ mapMode }),
  select: (selection) =>
    set((s) =>
      selection
        ? { selection, view: viewFor(selection), sheetSnap: 'half', panelOpen: true }
        : { selection: null, view: homeView(s), sheetSnap: 'peek' },
    ),
  // While navigating, "explore" (closing a view) returns to the trip.
  openView: (view) =>
    set((s) =>
      // Closing layers that was opened from directions goes back to the directions, not to explore.
      (view === 'explore' || view === 'navigation') && s.view === 'layers' && s.layersOverDirections
        ? { view: 'directions', layersOverDirections: false, sheetSnap: 'half', panelOpen: true }
        : view === 'explore' || view === 'navigation'
          ? { view: homeView(s), selection: null, sheetSnap: 'peek', panelOpen: true, layersOverDirections: false }
          : { view, sheetSnap: 'half', panelOpen: true, layersOverDirections: view === 'layers' && (s.view === 'directions' || (s.view === 'layers' && s.layersOverDirections)) },
    ),
  setSheetSnap: (sheetSnap) => set({ sheetSnap }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  search: (query, category = null) =>
    set((s) =>
      query || category
        ? { query, category, view: 'search', sheetSnap: 'half', panelOpen: true }
        : { query, category, view: homeView(s), selection: null, sheetSnap: 'peek', panelOpen: true },
    ),
  // A started route belongs to one start, destination, mode and kind: changing any of them ends it.
  directionsTo: (destination) =>
    set((s) => ({
      destination,
      // Directions to the place you start from make no sense: start from your location instead.
      origin: destination !== null && destination === s.origin ? null : s.origin,
      picking: null,
      view: 'directions',
      sheetSnap: 'half',
      panelOpen: true,
      ...(destination === s.destination ? {} : ended),
    })),
  setTripEnd: (end, id) =>
    set((s) => {
      const origin = end === 'origin' ? id : s.origin === id ? null : s.origin
      const destination = end === 'destination' ? id : s.destination === id ? null : s.destination
      const changed = origin !== s.origin || destination !== s.destination
      return { origin, destination, picking: null, view: 'directions', sheetSnap: 'half', panelOpen: true, ...(changed ? ended : {}) }
    }),
  // Swapping with "your location" as the start leaves the destination empty: there is no place id for "here".
  swapTripEnds: () => set((s) => ({ origin: s.destination, destination: s.origin, picking: null, ...ended })),
  // Picking on the map: get the sheet out of the way.
  setPicking: (picking) => set(picking ? { picking, sheetSnap: 'peek' } : { picking: null }),
  setTravelMode: (travelMode) => set((s) => (travelMode === s.travelMode ? {} : { travelMode, ...ended })),
  setRouteKind: (routeKind) => set((s) => (routeKind === s.routeKind ? {} : { routeKind, ...ended })),
  startRoute: (activeRouteId) =>
    set({ activeRouteId, nav: null, navFollowing: true, view: 'navigation', selection: null, sheetSnap: 'peek', panelOpen: true }),
  endRoute: () => set((s) => ({ ...ended, ...(s.view === 'navigation' ? { view: 'explore' as const, sheetSnap: 'peek' as const } : {}) })),
  setLeaveAt: (leaveAt) => set({ leaveAt }),
  toggleLayer: (id, on) => set((s) => ({ layerOverrides: { ...s.layerOverrides, [id]: on } })),
  setLiveLocationOptIn: (liveLocationOptIn) => set({ liveLocationOptIn }),
  setNav: (nav) => set({ nav }),
  setNavFollowing: (navFollowing) => set({ navFollowing }),
  setNavAimFree: (navAimFree) => set((s) => (s.navAimFree === navAimFree ? {} : { navAimFree })),
  setNavCharacter: (navCharacter) => set({ navCharacter }),
  back: () =>
    set((s) => {
      if (s.view === 'navigation') return {}
      if (s.picking) return { picking: null, sheetSnap: 'half' }
      if (s.view === 'layers' && s.layersOverDirections) return { view: 'directions', layersOverDirections: false, sheetSnap: 'half' }
      if (s.view === 'search' || s.view === 'explore') {
        return { query: '', category: null, selection: null, view: homeView(s), sheetSnap: 'peek' }
      }
      if (s.query || s.category) return { selection: null, view: 'search' }
      return { selection: null, view: homeView(s), sheetSnap: 'peek' }
    }),
}))
