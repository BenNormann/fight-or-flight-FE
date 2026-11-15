/**
 * Layer registry. Adding map data = adding one LayerDef to `layers`.
 * Toggles, legend and tap → sheet are all generated from this list;
 * there is no layer-specific UI anywhere else.
 */
import type { Layer } from '@deck.gl/core'
import type { BBox, CapabilityKey, IsoTime, MapMode, Selection } from '@/domain'

export interface LayerCtx {
  zoom: number
  bbox: BBox
  mode: MapMode
  theme: 'light' | 'dark'
  /** null = now. */
  leaveAt: IsoTime | null
  selection: Selection | null
}

export interface LegendSpec {
  title: string
  /** `color` is any CSS color (usually a token var). Labels are mandatory: never color-only. */
  items: { color: string; label: string }[]
}

export interface LayerDef<TData = unknown> {
  id: string
  label: string
  /** Phosphor icon name (`@phosphor-icons/react`). */
  icon: string
  /** Hidden entirely (toggle included) unless the backend serves this. */
  requires?: CapabilityKey
  minZoom?: number
  defaultOn: boolean
  /** Shown in the layer toggles. False for always-on base layers such as buildings. */
  userToggle?: boolean
  /** A query hook from src/api/queries.ts. Called only while the layer is active. */
  useData: (ctx: LayerCtx) => { data: TData | undefined; isLoading: boolean }
  /** Pure factory: data in, deck.gl layer(s) out. */
  build: (data: TData, ctx: LayerCtx) => Layer | Layer[] | null
  legend?: LegendSpec
  /** Tap behavior: map a picked object to the selection that opens the sheet. */
  onPick?: (object: unknown) => Selection | null
}

/** Keeps each entry's data type checked while storing a heterogeneous list. */
export const defineLayer = <TData>(def: LayerDef<TData>): LayerDef => def as unknown as LayerDef

export const layers: LayerDef[] = []
