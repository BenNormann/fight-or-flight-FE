import { ArrowLeftIcon } from '@phosphor-icons/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Suspense, lazy, useState, type ReactNode } from 'react'
import ManeuverBanner from '@/features/route/ManeuverBanner'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/state/store'
import { BottomSheet, IconButton, SHEET_PEEK_PX, SIDE_PANEL_PX, SidePanel, useVisualViewport } from '@/ui'
import { AccountButton } from './AccountButton'
import { CategoryChips, ControlStack, DirectionsFab, MapSearch } from './controls'
import { NavDevControl } from './NavDevControl'
import { ViewHost } from './ViewHost'

const SearchSurface = lazy(() => import('@/features/search/SearchSurface'))

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }

/**
 * Phones and tablets: floating search + chips, right stack, Directions FAB, bottom sheet.
 * Phone search: focusing the field turns the top chrome into a full-screen search
 * surface (field, back arrow, results) sized to the visual viewport, so the keyboard
 * never covers results; the sheet and map chrome are gone until it closes. The field
 * stays the same element throughout, so focus and the keyboard survive the switch.
 */
export function TouchLayout({ tablet, footer }: { tablet: boolean; footer: ReactNode }) {
  const snap = useAppStore((s) => s.sheetSnap)
  const setSnap = useAppStore((s) => s.setSheetSnap)
  const active = useAppStore((s) => s.activeRouteId)
  const search = useAppStore((s) => s.search)
  const [searching, setSearching] = useState(false)
  const takeover = searching && !tablet && !active
  const viewport = useVisualViewport()
  // On phones the sheet covers the lower controls once raised; on tablets the sheet sits left.
  const showLower = !takeover && (tablet || snap === 'peek')
  const aboveSheet = `calc(var(--safe-bottom) + ${SHEET_PEEK_PX + 16}px)`
  const inset = { paddingLeft: 'calc(var(--safe-left) + 16px)', paddingRight: 'calc(var(--safe-right) + 16px)' }

  const leave = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setSearching(false)
  }
  /** Back arrow / Escape: drop the query and return to the map. */
  const cancel = () => {
    search('', null)
    leave()
  }

  return (
    <>
      <div
        data-testid={takeover ? 'search-surface' : undefined}
        role={takeover ? 'dialog' : undefined}
        aria-label={takeover ? 'Search' : undefined}
        className={cn(
          'inset-x-0 flex flex-col gap-2',
          takeover ? 'fixed z-(--z-sheet) bg-background' : 'pointer-events-none absolute top-0 z-(--z-chrome)',
        )}
        style={{
          paddingTop: 'calc(var(--safe-top) + 12px)',
          ...(takeover ? { top: viewport.top, height: viewport.height } : {}),
        }}
      >
        {/* Navigating: the maneuver banner takes the place of search and chips. */}
        <AnimatePresence mode="wait" initial={false}>
          {active ? (
            <motion.div key="banner" className="px-gutter md:w-100 md:pr-0" style={{ paddingLeft: 'calc(var(--safe-left) + 16px)' }} {...fade}>
              <ManeuverBanner />
            </motion.div>
          ) : (
            <motion.div key="search" className="flex flex-col gap-2" {...fade}>
              <div className="px-gutter md:w-100 md:pr-0" style={{ paddingLeft: 'calc(var(--safe-left) + 16px)' }}>
                <MapSearch
                  overMap={!takeover}
                  leading={takeover ? <IconButton className="-ml-3" label="Close search" icon={<ArrowLeftIcon />} onClick={cancel} /> : undefined}
                  trailing={takeover ? undefined : <AccountButton />}
                  onFocus={tablet ? undefined : () => setSearching(true)}
                  onEscape={takeover ? cancel : undefined}
                  onSubmitted={takeover ? leave : undefined}
                />
              </div>
              {takeover ? null : <CategoryChips bleed={false} className="pointer-events-auto" />}
            </motion.div>
          )}
        </AnimatePresence>
        {takeover ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2" style={{ ...inset, paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}>
            <Suspense fallback={null}>
              <SearchSurface onDone={leave} />
            </Suspense>
          </div>
        ) : null}
        <AnimatePresence>
          {showLower ? (
            <motion.div key="stack" className="flex items-start justify-between gap-2 px-gutter" style={inset} {...fade}>
              {active ? <NavDevControl /> : <span />}
              <ControlStack />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showLower && !active ? (
          <motion.div
            key="fab"
            className="pointer-events-none absolute z-(--z-chrome)"
            style={{ bottom: tablet ? 'calc(var(--safe-bottom) + 24px)' : aboveSheet, right: 'calc(var(--safe-right) + 16px)' }}
            {...fade}
          >
            <DirectionsFab />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {takeover ? null : (
        <Suspense fallback={null}>
          <BottomSheet snap={snap} onSnapChange={setSnap} title="Campus details" floating={tablet}>
            <ViewHost footer={footer} />
          </BottomSheet>
        </Suspense>
      )}
    </>
  )
}

/** ≥ 1024px: collapsible left panel holds search and views; chips float over the map. */
export function DesktopLayout({ footer }: { footer: ReactNode }) {
  const open = useAppStore((s) => s.panelOpen)
  const setOpen = useAppStore((s) => s.setPanelOpen)
  const active = useAppStore((s) => s.activeRouteId)
  const reduce = useReducedMotion() ?? false
  const mapLeft = open ? SIDE_PANEL_PX : 0

  return (
    <>
      <SidePanel open={open} onOpenChange={setOpen} label="Campus details" top={<MapSearch overMap={false} />}>
        <ViewHost footer={footer} />
      </SidePanel>

      <motion.div
        className="pointer-events-none absolute top-0 right-0 left-0 z-(--z-chrome) flex flex-col items-start gap-3 p-4 pl-10"
        initial={false}
        animate={{ x: mapLeft }}
        transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Navigating: the maneuver banner sits top left in place of the chips. */}
        <AnimatePresence mode="wait" initial={false}>
          {active ? (
            <motion.div key="banner" className="flex w-full max-w-sm flex-col items-start gap-3" {...fade}>
              <ManeuverBanner />
              <NavDevControl />
            </motion.div>
          ) : (
            <motion.div key="chips" className="w-full" {...fade}>
              {/* Left bleed only; the right edge fades under the mask. */}
              <CategoryChips bleed={false} className={cn('pointer-events-auto -ml-4', open ? 'max-w-[calc(100vw-520px)]' : 'max-w-[calc(100vw-120px)]')} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Account: top right over the map, level with the chip row. */}
      <div className="pointer-events-none absolute top-4 right-6 z-(--z-chrome)">
        <AccountButton overMap />
      </div>

      <div className="pointer-events-none absolute right-6 bottom-6 z-(--z-chrome) flex flex-col items-end gap-3">
        <ControlStack zoom />
      </div>
    </>
  )
}
