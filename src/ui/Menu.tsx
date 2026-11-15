import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/vendor/dropdown-menu'
import { menuTriggerClass } from './menuTrigger'

/*
 * Loaded lazily through `@/ui` (see index.ts): Base UI's menu stays out of the first-paint bundle.
 * Entries are data, so callers never import menu parts statically.
 */

const item = 'min-h-tap gap-3 rounded-xl px-3 py-2 body-5 text-foreground focus:bg-accent data-highlighted:bg-accent [&_svg:not([class*=size-])]:size-5'

export type MenuEntry =
  | { kind: 'item'; id: string; label: ReactNode; icon?: ReactNode; onSelect: () => void; testId?: string }
  /** Toggle; the menu stays open so the new state is visible. */
  | { kind: 'check'; id: string; label: ReactNode; checked: boolean; onCheckedChange: (on: boolean) => void }
  | { kind: 'separator'; id: string }

export interface MenuProps {
  /** Accessible name of the trigger button. */
  label: string
  /** Trigger content (an avatar, an icon). The trigger is a 44px round button. */
  trigger: ReactNode
  triggerClassName?: string
  /** Popup heading block (e.g. who is signed in). */
  header?: ReactNode
  entries: MenuEntry[]
  /** Open on mount (the first tap loaded this module). */
  defaultOpen?: boolean
  testId?: string
}

/** Small popup menu anchored to a round trigger. Overlay elevation, no border (DESIGN §3 elevation). */
export default function Menu({ label, trigger, triggerClassName, header, entries, defaultOpen, testId }: MenuProps) {
  return (
    <DropdownMenu defaultOpen={defaultOpen}>
      <DropdownMenuTrigger aria-label={label} title={label} data-testid={testId} className={cn(menuTriggerClass, triggerClassName)}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-2xl bg-popover p-2 shadow-overlay ring-0">
        {header ? <div className="px-3 pt-2 pb-3">{header}</div> : null}
        {entries.map((e) =>
          e.kind === 'separator' ? (
            <DropdownMenuSeparator key={e.id} className="mx-1 my-1" />
          ) : e.kind === 'check' ? (
            <DropdownMenuCheckboxItem
              key={e.id}
              className={cn(item, 'pr-10')}
              checked={e.checked}
              closeOnClick={false}
              onCheckedChange={(on) => e.onCheckedChange(on)}
            >
              {e.label}
            </DropdownMenuCheckboxItem>
          ) : (
            <DropdownMenuItem key={e.id} className={item} onClick={e.onSelect} data-testid={e.testId}>
              {e.icon}
              {e.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
