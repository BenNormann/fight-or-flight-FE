import type { ReactNode } from 'react'

export interface NotifyOptions {
  title: string
  description?: string
  icon?: ReactNode
  /** `alert` interrupts screen readers; use for safety messages only. */
  politeness?: 'status' | 'alert'
  /** Same id replaces the previous toast instead of stacking. Defaults to the title. */
  id?: string
}

/** Sonner loads on first use (and with the lazy Toaster), keeping it out of the first-paint bundle. */
export function notify({ id, ...options }: NotifyOptions): void {
  void import('@/ui/vendor/halo-toast').then(({ showPolishedToast }) => showPolishedToast({ ...options, id: id ?? options.title }))
}
