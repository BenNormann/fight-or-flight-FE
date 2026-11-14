import type { ReactNode } from 'react'
import { showPolishedToast } from '@/ui/vendor/halo-toast'

export interface NotifyOptions {
  title: string
  description?: string
  icon?: ReactNode
  /** `alert` interrupts screen readers; use for safety messages only. */
  politeness?: 'status' | 'alert'
  /** Same id replaces the previous toast instead of stacking. Defaults to the title. */
  id?: string
}

export function notify({ id, ...options }: NotifyOptions) {
  return showPolishedToast({ ...options, id: id ?? options.title })
}
