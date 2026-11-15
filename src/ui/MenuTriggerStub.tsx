import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'
import { menuTriggerClass } from './menuTrigger'

/**
 * Static stand-in for a `Menu` trigger: looks identical, carries no menu code. Tapping it should
 * mount the lazy `Menu` with `defaultOpen`.
 */
export function MenuTriggerStub({ label, className, ...props }: ComponentProps<'button'> & { label: string }) {
  return <button type="button" aria-label={label} title={label} aria-haspopup="menu" className={cn(menuTriggerClass, className)} {...props} />
}
