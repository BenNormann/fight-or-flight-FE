import { MapPinned } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAppStore } from '@/state/store'
import { BottomSheet, SegmentedControl, notify, useTheme } from '@/ui'
import { demo } from './demoContent'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function Suggestions() {
  return (
    <ul className="-mx-gutter flex gap-2 overflow-x-auto px-gutter pb-1 [scrollbar-width:none]" aria-label="Suggestions">
      {demo.sheet.suggestions.map((s) => (
        <li key={s.id} className="shrink-0">
          <button
            type="button"
            className="min-h-tap rounded-full border border-border bg-secondary px-4 text-sm font-medium text-secondary-foreground transition-transform duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            onClick={() => notify({ id: 'suggestion', ...demo.toasts.suggestion })}
          >
            {s.label}
          </button>
        </li>
      ))}
    </ul>
  )
}

function EmptyState() {
  return (
    <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-8 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <MapPinned aria-hidden className="size-5" />
      </span>
      <p className="mt-3 text-base font-medium">{demo.sheet.emptyTitle}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{demo.sheet.emptyBody}</p>
    </div>
  )
}

function Appearance() {
  const { mode, setMode } = useTheme()
  return (
    <Section title={demo.sheet.appearance}>
      <SegmentedControl label={demo.sheet.appearance} options={demo.themeModes} value={mode} onChange={setMode} overMap={false} />
      <p className="mt-2 text-xs text-muted-foreground">{demo.themeHint}</p>
    </Section>
  )
}

/** Connects the store's snap to the sheet and renders placeholder content. */
export function SheetHost({ status }: { status: ReactNode }) {
  const snap = useAppStore((s) => s.sheetSnap)
  const setSnap = useAppStore((s) => s.setSheetSnap)

  return (
    <BottomSheet snap={snap} onSnapChange={setSnap} title={demo.sheet.title} description={demo.sheet.subtitle}>
      <Suggestions />
      <EmptyState />
      <Appearance />
      <div className="mt-8 flex justify-center">{status}</div>
    </BottomSheet>
  )
}
