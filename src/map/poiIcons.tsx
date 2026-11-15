/**
 * Places drawn into the map itself when zoomed in: a small round icon per category and the
 * place name, laid out by MapLibre so labels never overlap. Icons are Phosphor glyphs
 * rendered to images once per style (MapLibre cannot draw React components).
 */
import {
  BankIcon,
  BarbellIcon,
  BedIcon,
  BeerSteinIcon,
  BookOpenIcon,
  BuildingsIcon,
  BusIcon,
  CoffeeIcon,
  FirstAidKitIcon,
  ForkKnifeIcon,
  GraduationCapIcon,
  LetterCirclePIcon,
  MapPinIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  TicketIcon,
  TreeIcon,
  UsersThreeIcon,
  type Icon,
} from '@phosphor-icons/react'
import type { Feature, FeatureCollection, Point } from 'geojson'
import type { Map as MlMap } from 'maplibre-gl'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BBox, Id, Place } from '@/domain'
import { placeRank } from '@/state/places'

/** Backend top-level category id -> glyph. Unknown categories get the pin. */
const GLYPHS: Record<string, Icon> = {
  food: ForkKnifeIcon,
  cafe: CoffeeIcon,
  bar: BeerSteinIcon,
  grocery: ShoppingCartIcon,
  shopping: ShoppingBagIcon,
  parking: LetterCirclePIcon,
  transit: BusIcon,
  study: BookOpenIcon,
  campus: BuildingsIcon,
  education: GraduationCapIcon,
  health: FirstAidKitIcon,
  fitness: BarbellIcon,
  outdoors: TreeIcon,
  entertainment: TicketIcon,
  lodging: BedIcon,
  community: UsersThreeIcon,
  services: BankIcon,
  safety: ShieldCheckIcon,
  other: MapPinIcon,
}

export const POI_SOURCE = 'fof-poi'
export const POI_LAYER = 'fof-poi'
const imageId = (category: string) => `fof-poi-${category in GLYPHS ? category : 'other'}`

const SIZE = 22
const RATIO = 2

/** Draw the round icon for one category: a filled disc with the glyph on it. */
async function drawIcon(Glyph: Icon, colors: { disc: string; glyph: string; ring: string }): Promise<ImageData> {
  const px = SIZE * RATIO
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = px
  const g = canvas.getContext('2d')!
  g.beginPath()
  g.arc(px / 2, px / 2, px / 2 - RATIO, 0, Math.PI * 2)
  g.fillStyle = colors.disc
  g.fill()
  g.lineWidth = RATIO
  g.strokeStyle = colors.ring
  g.stroke()
  const svg = renderToStaticMarkup(<Glyph weight="fill" color={colors.glyph} size={px} />)
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  const inset = px * 0.24
  g.drawImage(img, inset, inset, px - inset * 2, px - inset * 2)
  return g.getImageData(0, 0, px, px)
}

/**
 * Add every category icon to the current style. Async (SVG decode); `stillCurrent` guards
 * against the style having been swapped (theme change) while the images were drawn.
 */
export async function installPoiIcons(map: MlMap, colors: { disc: string; glyph: string; ring: string }, stillCurrent: () => boolean) {
  await Promise.all(
    Object.entries(GLYPHS).map(async ([category, Glyph]) => {
      const data = await drawIcon(Glyph, colors).catch(() => null)
      if (!data || !stillCurrent()) return
      const id = imageId(category)
      if (map.hasImage(id)) map.updateImage(id, data)
      else map.addImage(id, data, { pixelRatio: RATIO })
    }),
  )
}

type PoiProps = { id: Id; name: string; icon: string; rank: number }

/** GeoJSON for the place layer. `skip`: places already shown as pins (results, the selection). */
export function poiFeatures(places: Place[], skip: ReadonlySet<Id> = new Set()): FeatureCollection<Point, PoiProps> {
  const features = places
    .filter((p) => !skip.has(p.id))
    .map((p): Feature<Point, PoiProps> => ({
      type: 'Feature',
      // Better known places win a label when two collide (MapLibre places lower sort keys first).
      properties: { id: p.id, name: p.name, icon: imageId(p.category ?? 'other'), rank: -placeRank(p) },
      geometry: { type: 'Point', coordinates: p.lngLat },
    }))
  return { type: 'FeatureCollection', features }
}

/**
 * How finely a cell is divided when choosing which places to label: 0 while zoomed out, then
 * 2, 4 and 8 blocks a side as the map zooms in, so zooming in keeps revealing more names.
 */
export const labelBlocks = (zoom: number) => (zoom < POI_DETAIL_ZOOM ? 0 : zoom < 16.75 ? 2 : zoom < 17.75 ? 4 : 8)

/** Never ask for more cells than this in one view (a very large window, zoomed out to the limit). */
const MAX_CELLS = 60

/** At and above this zoom cells are at their smallest and every kind of place is asked for. */
export const POI_DETAIL_ZOOM = 15.75
const BASE_CELL = 0.004

/**
 * Cell size in degrees: about 400 m when zoomed in, doubling with each zoom level out,
 * so any view is covered by roughly the same number of cells (and so of labels).
 */
export const cellSize = (zoom: number) => {
  const out = Math.max(0, Math.ceil(POI_DETAIL_ZOOM - zoom))
  // Zoomed out, a cell's answer is only the 50 places nearest its middle, so cells are kept half
  // as large as the doubling alone would make them: more, smaller samples spread the labels out.
  return BASE_CELL * 2 ** Math.max(0, out - 1)
}

/**
 * The grid cells that cover the view, nearest the middle first. Cells are fixed squares on the
 * map, so panning or zooming within a size band reuses the cells already loaded.
 */
export function gridCells([w, s, e, n]: BBox, zoom: number): BBox[] {
  const size = cellSize(zoom)
  const r = (v: number) => Math.round(v * 1e6) / 1e6
  const cells: BBox[] = []
  for (let x = Math.floor(w / size); x * size < e; x++)
    for (let y = Math.floor(s / size); y * size < n; y++) cells.push([r(x * size), r(y * size), r((x + 1) * size), r((y + 1) * size)])
  const cx = (w + e) / 2
  const cy = (s + n) / 2
  const d = (c: BBox) => Math.hypot((c[0] + c[2]) / 2 - cx, (c[1] + c[3]) / 2 - cy)
  return cells.sort((a, b) => d(a) - d(b)).slice(0, MAX_CELLS)
}
