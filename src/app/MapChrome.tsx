import { Layers, LocateFixed, Moon, Siren, Sun, SunMoon } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState, useSyncExternalStore } from 'react'
import { useAppStore } from '@/state/store'
import { Fab, SearchBar, SegmentedControl, SHEET_PEEK_PX, nextThemeMode, notify, useTheme, type ThemeMode } from '@/ui'
import { demo } from './demoContent'

const themeIcon: Record<ThemeMode, typeof Sun> = { auto: SunMoon, light: Sun, dark: Moon }

/** Bottom of the FAB row: just above the peeking sheet. */
const aboveSheet = `calc(var(--safe-bottom) + ${SHEET_PEEK_PX + 12}px)`

function useViewportHeight() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('resize', cb)
      return () => window.removeEventListener('resize', cb)
    },
    () => window.innerHeight,
    () => 844,
  )
}

function ThemeButton() {
  const { mode, setMode } = useTheme()
  const Icon = themeIcon[mode]
  return (
    <Fab
      size="tap"
      label={demo.a11y.theme(mode)}
      icon={<Icon />}
      className="border-0 bg-transparent shadow-none backdrop-blur-none hover:bg-accent"
      onClick={() => {
        const next = nextThemeMode(mode)
        setMode(next)
        notify({ id: 'theme', ...demo.toasts.theme(next) })
      }}
    />
  )
}

/** Floating controls over the map. Layout per ARCHITECTURE §4. */
export function MapChrome() {
  const mapMode = useAppStore((s) => s.mapMode)
  const setMapMode = useAppStore((s) => s.setMapMode)
  const sheetSnap = useAppStore((s) => s.sheetSnap)
  const [searching, setSearching] = useState(false)
  const reduce = useReducedMotion() ?? false
  const showMapControls = sheetSnap === 'peek' && !searching
  const viewportHeight = useViewportHeight()

  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-(--z-chrome) flex flex-col items-end gap-3 px-gutter"
        style={{
          paddingTop: 'calc(var(--safe-top) + 12px)',
          paddingLeft: 'calc(var(--safe-left) + 16px)',
          paddingRight: 'calc(var(--safe-right) + 16px)',
        }}
      >
        <div className="w-full max-w-xl self-center">
          <SearchBar
            placeholder={demo.search.placeholder}
            onFocusChange={setSearching}
            onSubmit={() => notify({ id: 'search', ...demo.toasts.search })}
            trailing={<ThemeButton />}
          />
        </div>
        <AnimatePresence initial={false}>
          {showMapControls ? (
            <motion.div
              key="layers"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Fab
                size="tap"
                label={demo.a11y.layers}
                icon={<Layers />}
                onClick={() => notify({ id: 'layers', ...demo.toasts.layers })}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {showMapControls ? (
          <motion.div
            key="map-controls"
            className="pointer-events-none absolute right-0 z-(--z-chrome) flex flex-col items-end gap-3"
            style={{ bottom: aboveSheet, right: 'calc(var(--safe-right) + 16px)' }}
            initial={{ opacity: 0, y: reduce ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduce ? 0 : 8 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <Fab label={demo.a11y.locate} icon={<LocateFixed />} onClick={() => notify({ id: 'locate', ...demo.toasts.locate })} />
            <div className="pointer-events-auto">
              <SegmentedControl label={demo.a11y.mapMode} options={demo.mapModes} value={mapMode} onChange={setMapMode} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Always visible, bottom-left thumb zone. Rides above the half sheet; never pulses. */}
      <motion.div
        className="pointer-events-none absolute z-(--z-safety)"
        style={{ bottom: aboveSheet, left: 'calc(var(--safe-left) + 16px)' }}
        initial={false}
        animate={{ y: sheetSnap === 'half' ? -(viewportHeight / 2 - SHEET_PEEK_PX) : 0 }}
        transition={{ duration: reduce ? 0 : 0.5, ease: [0.32, 0.72, 0, 1] }}
      >
        <Fab
          data-testid="safety-fab"
          tone="destructive"
          label={demo.a11y.safety}
          text={demo.a11y.safetyText}
          icon={<Siren />}
          onClick={() => notify({ id: 'safety', politeness: 'alert', ...demo.toasts.safety })}
        />
      </motion.div>
    </>
  )
}
