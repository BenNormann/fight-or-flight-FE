import { CalendarDotsIcon, FlameIcon, LetterCirclePIcon, PhoneIcon, StackIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { demoLayerDefaults, demoLayers } from '@/demo'
import type { MapMode } from '@/domain'
import { riskBands } from '@/lib/risk'
import { layers as registry } from '@/map/layers/registry'
import { useAppStore } from '@/state/store'
import { Section, SegmentedControl, SwitchRow, ViewHeader, useTheme, type ThemeMode } from '@/ui'

const MAP_MODES: { value: MapMode; label: string }[] = [
  { value: '2d', label: '2D' },
  { value: 'iso', label: 'Iso' },
  { value: '3d', label: '3D' },
]
const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]
const demoIcon: Record<string, ReactNode> = {
  'demo-safety': <FlameIcon />,
  'demo-bluelights': <PhoneIcon />,
  'demo-events': <CalendarDotsIcon />,
  'demo-transit': <LetterCirclePIcon />,
}

/** Map view, data toggles (generated from the layer list) and appearance. */
export default function LayersView() {
  const mapMode = useAppStore((s) => s.mapMode)
  const setMapMode = useAppStore((s) => s.setMapMode)
  const overrides = useAppStore((s) => s.layerOverrides)
  const toggleLayer = useAppStore((s) => s.toggleLayer)
  const back = useAppStore((s) => s.back)
  const { mode, setMode } = useTheme()

  const toggles = [
    ...registry.filter((l) => l.userToggle !== false).map((l) => ({ id: l.id, label: l.label, description: undefined, on: overrides[l.id] ?? l.defaultOn })),
    ...demoLayers.map((l) => ({ id: l.id, label: l.label, description: l.description, on: overrides[l.id] ?? demoLayerDefaults[l.id] ?? false })),
  ]
  const heatOn = overrides['demo-safety'] ?? demoLayerDefaults['demo-safety']

  return (
    <div data-testid="view-layers">
      <ViewHeader title="Map layers" onBack={back} />
      <Section title="Map view">
        <SegmentedControl label="Map view" options={MAP_MODES} value={mapMode} onChange={setMapMode} overMap={false} className="w-full [&>div]:w-full" />
      </Section>
      <Section title="Map details">
        <ul className="flex flex-col">
          {toggles.map((t) => (
            // Each row is its own flex line so label block and switch share one centre line.
            <li key={t.id} className="flex min-h-14 items-center">
              <SwitchRow
                label={t.label}
                description={t.description}
                icon={demoIcon[t.id] ?? <StackIcon />}
                checked={t.on}
                onCheckedChange={(on) => toggleLayer(t.id, on)}
              />
            </li>
          ))}
        </ul>
        {heatOn ? (
          <ul aria-label="Safety heat legend" className="mt-2 grid gap-2 rounded-xl border border-border p-3">
            {riskBands.map((b) => (
              <li key={b.level} className="caption-4 flex min-h-6 items-center gap-2">
                <span aria-hidden className="h-2 w-6 shrink-0 rounded-full" style={{ background: `var(${b.cssVar})` }} />
                {b.label}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
      <Section title="Appearance">
        <SegmentedControl label="Theme" options={THEMES} value={mode} onChange={setMode} overMap={false} className="w-full [&>div]:w-full" />
        <p className="caption-5 mt-2 text-muted-foreground">Auto switches to night colours from <span className="font-mono">18:00</span> to <span className="font-mono">06:00</span>.</p>
      </Section>
    </div>
  )
}
