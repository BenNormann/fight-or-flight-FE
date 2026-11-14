import { create } from 'zustand'
import type { IsoTime, MapMode, Selection, SheetSnap } from '@/domain'

/** The one UI store. Server data lives in TanStack Query; shareable state lives in the URL. */
export interface AppState {
  mapMode: MapMode
  selection: Selection | null
  sheetSnap: SheetSnap
  /** null = leave now. */
  leaveAt: IsoTime | null
  /** Layer ids the user toggled, overriding each LayerDef.defaultOn. */
  layerOverrides: Record<string, boolean>

  setMapMode: (mode: MapMode) => void
  /** Selecting something opens the sheet to half; clearing drops it to peek. */
  select: (selection: Selection | null) => void
  setSheetSnap: (snap: SheetSnap) => void
  setLeaveAt: (at: IsoTime | null) => void
  toggleLayer: (id: string, on: boolean) => void
}

export const useAppStore = create<AppState>()((set) => ({
  mapMode: '2d',
  selection: null,
  sheetSnap: 'peek',
  leaveAt: null,
  layerOverrides: {},

  setMapMode: (mapMode) => set({ mapMode }),
  select: (selection) => set({ selection, sheetSnap: selection ? 'half' : 'peek' }),
  setSheetSnap: (sheetSnap) => set({ sheetSnap }),
  setLeaveAt: (leaveAt) => set({ leaveAt }),
  toggleLayer: (id, on) => set((s) => ({ layerOverrides: { ...s.layerOverrides, [id]: on } })),
}))
