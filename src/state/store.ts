import { create } from 'zustand'
import type { Id, IsoTime, MapMode, NavCharacterId, NavProgress, RouteKind, Selection, SheetSnap } from '@/domain'

/** Which view the sheet (mobile) or side panel (desktop) shows. One feature folder each. */
export type PanelView = 'explore' | 'search' | 'place' | 'directions' | 'navigation' | 'events' | 'layers' | 'safety'
export type TravelMode = 'walk' | 'bike' | 'ride'

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
  /** Destination for directions (an entity id). */
  destination: Id | null
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
  navCharacter: NavCharacterId

  setMapMode: (mode: MapMode) => void
  /** Selecting an entity opens its view at half; clearing returns to explore at peek. */
  select: (selection: Selection | null) => void
  openView: (view: PanelView) => void
  setSheetSnap: (snap: SheetSnap) => void
  setPanelOpen: (open: boolean) => void
  search: (query: string, category?: string | null) => void
  directionsTo: (destination: Id | null) => void
  setTravelMode: (mode: TravelMode) => void
  setRouteKind: (kind: RouteKind) => void
  startRoute: (routeId: Id) => void
  endRoute: () => void
  setLeaveAt: (at: IsoTime | null) => void
  toggleLayer: (id: string, on: boolean) => void
  setLiveLocationOptIn: (on: boolean) => void
  setNav: (nav: NavProgress | null) => void
  setNavFollowing: (following: boolean) => void
  setNavCharacter: (id: NavCharacterId) => void
  /** Back one level: detail → explore. */
  back: () => void
}

const viewFor = (s: Selection): PanelView =>
  s.kind === 'route' ? 'directions' : s.kind === 'event' ? 'events' : s.kind === 'riskCell' ? 'safety' : 'place'

/** The resting view: the trip while a route is started, otherwise explore. */
const homeView = (s: Pick<AppState, 'activeRouteId'>): PanelView => (s.activeRouteId ? 'navigation' : 'explore')

/** Fields that end a started route. */
const ended = { activeRouteId: null, nav: null, navFollowing: true } as const

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
  destination: null,
  activeRouteId: null,
  layerOverrides: {},
  liveLocationOptIn: false,
  nav: null,
  navFollowing: true,
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
      view === 'explore' || view === 'navigation'
        ? { view: homeView(s), selection: null, sheetSnap: 'peek', panelOpen: true }
        : { view, sheetSnap: 'half', panelOpen: true },
    ),
  setSheetSnap: (sheetSnap) => set({ sheetSnap }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  search: (query, category = null) =>
    set((s) =>
      query || category
        ? { query, category, view: 'search', sheetSnap: 'half', panelOpen: true }
        : { query, category, view: homeView(s), selection: null, sheetSnap: 'peek', panelOpen: true },
    ),
  // A started route belongs to one destination, mode and kind: changing any of them ends it.
  directionsTo: (destination) =>
    set((s) => ({
      destination,
      view: 'directions',
      sheetSnap: 'half',
      panelOpen: true,
      ...(destination === s.destination ? {} : ended),
    })),
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
  setNavCharacter: (navCharacter) => set({ navCharacter }),
  back: () =>
    set((s) => {
      if (s.view === 'navigation') return {}
      if (s.view === 'search' || s.view === 'explore') {
        return { query: '', category: null, selection: null, view: homeView(s), sheetSnap: 'peek' }
      }
      if (s.query || s.category) return { selection: null, view: 'search' }
      return { selection: null, view: homeView(s), sheetSnap: 'peek' }
    }),
}))
