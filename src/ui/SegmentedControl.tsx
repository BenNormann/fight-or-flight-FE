import type { ReactNode } from 'react'
import { HaloSegmented } from '@/ui/vendor/halo-segmented'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

export interface SegmentedControlProps<T extends string> {
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** Frosted for use over the map; solid inside the sheet. */
  overMap?: boolean
  className?: string
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  overMap = true,
  className,
}: SegmentedControlProps<T>) {
  return (
    <HaloSegmented
      aria-label={label}
      className={className}
      items={options.map((o) => ({ value: o.value, label: o.label }))}
      onValueChange={(next) => onChange(next as T)}
      translucent={overMap}
      value={value}
    />
  )
}
