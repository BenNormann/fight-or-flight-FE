import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Suspense, type ReactNode } from 'react'
import ActiveRoutePill from '@/features/route/ActiveRoutePill'
import { useAppStore } from '@/state/store'
import { BottomSheet, SHEET_PEEK_PX, SIDE_PANEL_PX, SidePanel } from '@/ui'
import { CategoryChips, ControlStack, DirectionsFab, MapSearch } from './controls'
import { ViewHost } from './ViewHost'

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }

/** Phones and tablets: floating search + chips, right stack, Directions FAB, bottom sheet. */
export function TouchLayout({ tablet, footer }: { tablet: boolean; footer: ReactNode }) {
  const snap = useAppStore((s) => s.sheetSnap)
  const setSnap = useAppStore((s) => s.setSheetSnap)
  const active = useAppStore((s) => s.activeRouteId)
  // On phones the sheet covers the lower controls once raised; on tablets the sheet sits left.
  const showLower = tablet || snap === 'peek'
  const aboveSheet = `calc(var(--safe-bottom) + ${SHEET_PEEK_PX + 16}px)`

  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-(--z-chrome) flex flex-col gap-2"
        style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
      >
        <div className="px-gutter md:w-100 md:pr-0" style={{ paddingLeft: 'calc(var(--safe-left) + 16px)' }}>
          <MapSearch />
        </div>
        <CategoryChips className="pointer-events-auto px-gutter py-1" />
        <AnimatePresence>
          {active ? (
            <motion.div key="pill" className="flex justify-center px-gutter" {...fade}>
              <ActiveRoutePill />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <AnimatePresence>
          {showLower ? (
            <motion.div key="stack" className="flex justify-end px-gutter" style={{ paddingRight: 'calc(var(--safe-right) + 16px)' }} {...fade}>
              <ControlStack />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showLower ? (
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

      <Suspense fallback={null}>
        <BottomSheet snap={snap} onSnapChange={setSnap} title="Campus details" floating={tablet}>
          <ViewHost footer={footer} />
        </BottomSheet>
      </Suspense>
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
        <CategoryChips className={open ? "pointer-events-auto max-w-[calc(100vw-480px)]" : "pointer-events-auto max-w-[calc(100vw-80px)]"} />
        <AnimatePresence>
          {active ? (
            <motion.div key="pill" className="w-full max-w-sm" {...fade}>
              <ActiveRoutePill />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>

      <div className="pointer-events-none absolute right-6 bottom-6 z-(--z-chrome) flex flex-col items-end gap-3">
        <ControlStack />
      </div>
    </>
  )
}
