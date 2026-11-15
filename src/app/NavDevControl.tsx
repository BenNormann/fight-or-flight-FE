import { GpsFixIcon, PauseIcon, PlayIcon, PersonSimpleWalkIcon } from '@phosphor-icons/react'
import { env } from '@/lib/env'
import { cn } from '@/lib/cn'
import { IconButton } from '@/ui'
import { SIM_RATES, useNavDriverSettings } from './navDriverSettings'

/** Development builds and mock mode only. */
const showNavDevControl = import.meta.env.DEV || env.useMocks

const pill = 'pointer-events-auto button-sm inline-flex h-tap min-w-tap items-center justify-center gap-1 rounded-full px-3 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] transition-[transform,background-color] duration-200'

/** Small floating control for the navigation driver: position source, pause, and walk speed. */
export function NavDevControl({ className }: { className?: string }) {
  const source = useNavDriverSettings((s) => s.source)
  const paused = useNavDriverSettings((s) => s.paused)
  const rate = useNavDriverSettings((s) => s.rate)
  const { setSource, setPaused, setRate } = useNavDriverSettings.getState()
  if (!showNavDevControl) return null
  const simulated = source === 'simulated'

  return (
    <div
      role="group"
      aria-label="Navigation simulator (development)"
      data-testid="nav-dev-control"
      className={cn('pointer-events-auto flex items-center gap-1 rounded-full bg-card p-0.5 shadow-chip', className)}
    >
      <button
        type="button"
        className={pill}
        aria-label={simulated ? 'Position: simulated walk. Switch to device GPS' : 'Position: device GPS. Switch to simulated walk'}
        onClick={() => setSource(simulated ? 'device' : 'simulated')}
      >
        {simulated ? <PersonSimpleWalkIcon aria-hidden className="size-4" /> : <GpsFixIcon aria-hidden className="size-4" />}
        {simulated ? 'Sim' : 'GPS'}
      </button>
      {simulated ? (
        <>
          <IconButton label={paused ? 'Resume walk' : 'Pause walk'} icon={paused ? <PlayIcon /> : <PauseIcon />} onClick={() => setPaused(!paused)} data-testid="nav-sim-pause" />
          <button
            type="button"
            className={cn(pill, 'font-mono')}
            aria-label={`Walk speed ${rate} times. Change speed`}
            data-testid="nav-sim-rate"
            onClick={() => setRate(SIM_RATES[(SIM_RATES.indexOf(rate) + 1) % SIM_RATES.length]!)}
          >
            {rate}×
          </button>
        </>
      ) : null}
    </div>
  )
}
