import { CalendarDotsIcon, FlameIcon, LetterCirclePIcon, PhoneIcon, StackIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { SAFETY_HEAT_LAYER, demoLayers, type DemoLayerIcon } from '@/demo'
import { NAV_CHARACTERS, type MapMode, type NavCharacterId } from '@/domain'
import { riskBands } from '@/lib/risk'
import { formatHour } from '@/lib/time'
import { layers as registry } from '@/map/layers/registry'
import { useAppStore } from '@/state/store'
import { Section, SegmentedControl, SwitchRow, ViewHeader, useTheme, type ThemeMode } from '@/ui'

const MAP_MODES: { value: MapMode; label: string }[] = [
  { value: '2d', label: '2D' },
  { value: 'iso', label: 'Iso' },
  { value: '3d', label: '3D' },
]
const CHARACTERS: { value: NavCharacterId; label: string }[] = NAV_CHARACTERS.map((c) => ({ value: c.id, label: c.label }))
const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]
const ICONS: Record<DemoLayerIcon, ReactNode> = {
  heat: <FlameIcon />,
  phone: <PhoneIcon />,
  events: <CalendarDotsIcon />,
  parking: <LetterCirclePIcon />,
}

/** Map view, data toggles (generated from the layer list) and appearance. */
export default function LayersView() {
  const mapMode = useAppStore((s) => s.mapMode)
  const setMapMode = useAppStore((s) => s.setMapMode)
  const overrides = useAppStore((s) => s.layerOverrides)
  const toggleLayer = useAppStore((s) => s.toggleLayer)
  const back = useAppStore((s) => s.back)
  const { mode, setMode } = useTheme()
  const navCharacter = useAppStore((s) => s.navCharacter)
  const setNavCharacter = useAppStore((s) => s.setNavCharacter)

  const toggles = [
    ...registry.filter((l) => l.userToggle !== false).map((l) => ({ id: l.id, label: l.label, description: undefined, icon: <StackIcon />, on: overrides[l.id] ?? l.defaultOn })),
    ...demoLayers.map((l) => ({ id: l.id, label: l.label, description: l.description, icon: ICONS[l.icon], on: overrides[l.id] ?? l.defaultOn })),
  ]
  const heatOn = toggles.find((t) => t.id === SAFETY_HEAT_LAYER)?.on ?? false

  return (
    <div data-testid="view-layers">
      <ViewHeader title="Map layers" onBack={back} />
      <Section title="Map view">
        <SegmentedControl label="Map view" options={MAP_MODES} value={mapMode} onChange={setMapMode} overMap={false} className="w-full [&>div]:w-full" />
      </Section>
      <Section title="Map details">
        <ul>
          {toggles.map((t) => (
            <li key={t.id}>
              <SwitchRow
                label={t.label}
                description={t.description}
                icon={t.icon}
                checked={t.on}
                onCheckedChange={(on) => toggleLayer(t.id, on)}
              />
            </li>
          ))}
        </ul>
        {heatOn ? (
          <ul aria-label="Safety heat legend" className="mt-2 grid gap-1 rounded-xl border border-border p-3">
            {riskBands.map((b) => (
              <li key={b.level} className="caption-4 flex min-h-6 items-center gap-2">
                <span aria-hidden className="h-2 w-6 shrink-0 rounded-full" style={{ background: `var(${b.cssVar})` }} />
                {b.label}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
      <Section title="Your character">
        <SegmentedControl label="Character shown while navigating" options={CHARACTERS} value={navCharacter} onChange={setNavCharacter} overMap={false} className="w-full [&>div]:w-full" />
        <p className="caption-4 mt-2 text-muted-foreground">Marks your position while you follow directions.</p>
      </Section>

      <Section title="Appearance">
        <SegmentedControl label="Theme" options={THEMES} value={mode} onChange={setMode} overMap={false} className="w-full [&>div]:w-full" />
        <p className="caption-5 mt-2 text-muted-foreground">Auto switches to night colours from {formatHour(18)} to {formatHour(6)}.</p>
      </Section>
    </div>
  )
}
