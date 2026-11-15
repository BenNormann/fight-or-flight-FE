import { SignInIcon, SignOutIcon } from '@phosphor-icons/react'
import { Suspense, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { loginRoute } from '@/api/adapters/auth'
import { useCapability } from '@/api/capabilities'
import { useSession, useSignOut } from '@/api/queries'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/state/store'
import { IconButton, Menu, MenuTriggerStub, notify, type MenuEntry } from '@/ui'
import { HelmetMark } from './HelmetMark'

/**
 * Top right account control. Signed out: sign-in icon → `/login`. Signed in: the email's first
 * letter on a cardinal circle wearing a gold open-face helmet, opening a menu with the email, location sharing and Sign out.
 * Hidden when the backend serves no auth.
 */
export function AccountButton({ overMap = false }: { overMap?: boolean }) {
  const { status, user } = useSession()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const location = useLocation()
  const liveServed = useCapability('liveLocation')
  const sharing = useAppStore((s) => s.liveLocationOptIn)
  const setSharing = useAppStore((s) => s.setLiveLocationOptIn)
  const [menuLoaded, setMenuLoaded] = useState(false)

  if (status === 'off') return null
  // Reserve the slot while the session loads so the pill does not jump.
  if (status === 'pending') return <span aria-hidden className="size-tap shrink-0" />

  if (!user) {
    return (
      <IconButton
        tone={overMap ? 'float' : 'ghost'}
        label="Sign in"
        data-testid="account-sign-in"
        icon={<SignInIcon />}
        className="pointer-events-auto"
        onClick={() => navigate(loginRoute(location.pathname + location.search))}
      />
    )
  }

  const initial = (user.email.trim()[0] ?? '?').toUpperCase()
  const label = `Account, signed in as ${user.email}`
  const triggerClassName = cn(overMap && 'bg-card shadow-float hover:bg-accent')
  const avatar = (
    <span aria-hidden className="title-4 relative grid size-8 place-items-center rounded-full bg-brand text-brand-foreground">
      {/* Sits in the helmet's eye band and slit, just below the brow. */}
      <span className="translate-y-[3px] text-[13px] leading-none">{initial}</span>
      <HelmetMark />
    </span>
  )
  // Until the first tap, a static stand-in: the menu code (Base UI) loads only when it is opened.
  const stub = (
    <MenuTriggerStub label={label} data-testid="account-menu" className={triggerClassName} onClick={() => setMenuLoaded(true)}>
      {avatar}
    </MenuTriggerStub>
  )
  if (!menuLoaded) return stub

  const entries: MenuEntry[] = [
    ...(liveServed
      ? [{ kind: 'check' as const, id: 'share', label: 'Share my live location', checked: sharing, onCheckedChange: setSharing }]
      : []),
    { kind: 'separator', id: 'sep' },
    {
      kind: 'item',
      id: 'sign-out',
      label: 'Sign out',
      icon: <SignOutIcon />,
      testId: 'account-sign-out',
      onSelect: () => {
        setSharing(false)
        const s = useAppStore.getState()
        // Directions need a session: leave them rather than bounce to the sign-in page.
        if (s.view === 'directions') s.openView('explore')
        signOut.mutate(undefined, { onSettled: () => notify({ title: 'Signed out' }) })
      },
    },
  ]

  return (
    <Suspense fallback={stub}>
      <Menu
        defaultOpen
        label={label}
        testId="account-menu"
        triggerClassName={triggerClassName}
        trigger={avatar}
        entries={entries}
        header={
          <>
            {user.name ? <p className="title-3 truncate">{user.name}</p> : null}
            <p className="body-6 truncate text-muted-foreground" data-testid="account-email">
              {user.email}
            </p>
          </>
        }
      />
    </Suspense>
  )
}
