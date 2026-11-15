import type { SheetSnap } from '@/domain'
import type { Breakpoint } from '@/ui'

/*
 * Screen px the app chrome covers over the map, per layout (src/app/layouts.tsx).
 * Approximate on purpose: the camera only needs to keep targets clear of it.
 */
/** Screen px covered by chrome on each side; becomes the MapLibre camera padding. */
export interface Insets {
  top: number
  right: number
  bottom: number
  left: number
}

const GAP = 16
const TAP = 44
const SHEET_PEEK = 96
const PANEL = 400
/** Search pill + chip row under the safe area (phone and tablet). */
const TOUCH_TOP = 12 + 48 + 8 + TAP + 8
/** Chip row over the map (desktop). */
const DESKTOP_TOP = GAP + TAP + GAP
/** Active route pill under the chips. */
const ROUTE_PILL = 64
/** Right control stack column. */
const CONTROLS = GAP + TAP + 8

export interface ChromeState {
  breakpoint: Breakpoint
  sheetSnap: SheetSnap
  panelOpen: boolean
  routeActive: boolean
  viewportW: number
  viewportH: number
}

export function chromeInsets({ breakpoint, sheetSnap, panelOpen, routeActive, viewportW, viewportH }: ChromeState): Insets {
  const pill = routeActive ? ROUTE_PILL : 0
  if (breakpoint === 'desktop') {
    return { top: DESKTOP_TOP + pill, right: 24 + TAP + GAP, bottom: GAP, left: (panelOpen ? PANEL : 0) + GAP }
  }
  if (breakpoint === 'tablet') {
    // Floating 400px sheet at the bottom left. Peek: a bottom strip. Full: the left column.
    // Half: whichever of "above the sheet" or "right of the sheet" leaves the larger area.
    const top = TOUCH_TOP + pill
    const below = { top, right: CONTROLS, bottom: SHEET_PEEK + GAP, left: GAP }
    const above = { top, right: CONTROLS, bottom: viewportH / 2 + GAP, left: GAP }
    const beside = { top, right: CONTROLS, bottom: GAP, left: GAP + PANEL + GAP }
    if (sheetSnap === 'peek') return below
    if (sheetSnap === 'full') return beside
    const area = (i: Insets) => (viewportW - i.left - i.right) * (viewportH - i.top - i.bottom)
    return area(above) >= area(beside) ? above : beside
  }
  const sheet = sheetSnap === 'peek' ? SHEET_PEEK : sheetSnap === 'half' ? viewportH / 2 : viewportH
  return {
    top: TOUCH_TOP + pill,
    // The control stack hides once the sheet is raised. While navigating the sides stay even, so the
    // traveller sits in the middle of the screen, not pushed left by the buttons.
    right: sheetSnap === 'peek' && !routeActive ? CONTROLS : GAP,
    bottom: sheet + GAP,
    left: GAP,
  }
}
