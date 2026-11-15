import { ArrowLeftIcon, MapTrifoldIcon, WarningCircleIcon, WrenchIcon } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ALLOWED_EMAIL_DOMAIN, buildLoginUrl, isAllowedEmail, loginErrorMessage, safeNext } from '@/api/adapters/auth'
import { ApiError } from '@/api/client'
import { queryKeys } from '@/api/queries'
import { env } from '@/lib/env'
import { Button, Keystone } from '@/ui'

/** Full screen on phones; a centred card from 768px. Opaque, so the map and sheet stay mounted underneath. */
function AuthFrame({ children, onBack, backLabel }: { children: ReactNode; onBack: () => void; backLabel: string }) {
  return (
    <main
      data-testid="login-page"
      className="fixed inset-0 z-(--z-safety) flex flex-col overflow-y-auto bg-background md:items-center md:justify-center md:p-8"
      style={{
        paddingTop: 'calc(var(--safe-top) + 8px)',
        paddingBottom: 'calc(var(--safe-bottom) + 24px)',
        paddingLeft: 'calc(var(--safe-left) + 16px)',
        paddingRight: 'calc(var(--safe-right) + 16px)',
      }}
    >
      <div className="flex min-h-full w-full flex-1 flex-col md:min-h-0 md:max-w-sm md:flex-none md:rounded-2xl md:bg-card md:p-6 md:shadow-raised">
        <button
          type="button"
          onClick={onBack}
          className="button-sm -ml-2 inline-flex min-h-tap items-center gap-2 self-start rounded-xl px-2 text-foreground outline-none transition-[transform,background-color] duration-200 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] [&_svg]:size-4"
        >
          <ArrowLeftIcon aria-hidden />
          {backLabel}
        </button>
        <div className="flex flex-1 flex-col justify-center py-8 md:py-6">{children}</div>
      </div>
    </main>
  )
}

function BrandMark() {
  return (
    <span aria-hidden className="relative grid size-12 place-items-center rounded-2xl bg-brand text-brand-accent [&_svg]:size-6">
      <MapTrifoldIcon weight="fill" />
      <Keystone />
    </span>
  )
}

/** Inline error: icon plus a sentence (DESIGN §1: never colour alone). */
function InlineError({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p role="alert" data-testid={testId} className="body-6 mt-4 flex items-start gap-2 text-destructive">
      <WarningCircleIcon aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

/** Back to wherever the user came from; a cold landing on `/login` goes to the map. */
function useBack() {
  const navigate = useNavigate()
  // React Router keeps the in-app history index in history.state; 0 means nothing of ours to go back to
  // (a cold link, or a gated `/route` link that was replaced).
  return () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) void navigate(-1)
    else void navigate('/', { replace: true })
  }
}

/** `/login?next=…`: one action that hands the browser to the sign-in provider. */
export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const back = useBack()
  const next = safeNext(params.get('next'), window.location.origin)
  const directions = next.startsWith('/route')
  // The backend sends the browser back here with `?error=` when it refuses the account.
  const error = loginErrorMessage(params.get('error'))

  return (
    <AuthFrame onBack={back} backLabel="Back to map">
      <BrandMark />
      <h1 className="heading-5 mt-6">Sign in to Fight or Flight</h1>
      <p className="body-3 mt-2 text-muted-foreground">
        {directions ? 'Sign in with your USC email to get walking directions.' : 'Sign in with your USC email to use directions and location sharing.'}
      </p>
      {error ? <InlineError testId="login-error">{error}</InlineError> : null}
      <Button
        tone="brand"
        block
        className="mt-8"
        data-testid="login-continue"
        onClick={() => {
          const url = buildLoginUrl(next, window.location.origin, env.useMocks)
          // Mock mode: the dev stand-in is an in-app page. Real: a full-page redirect to the backend.
          if (env.useMocks) navigate(url, { replace: true })
          else window.location.assign(url)
        }}
      >
        Continue
      </Button>
    </AuthFrame>
  )
}

/**
 * Mock mode only (`/login/dev`): stands in for the provider and callback. Clearly a development
 * tool: no provider branding, no password, a test email (USC only, like the backend).
 */
export function DevSignInPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const back = useBack()
  const next = safeNext(params.get('next'), window.location.origin)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  useEffect(() => {
    if (env.useMocks) void import('@/api/mocks/session').then((m) => setEmail((e) => e || m.DEV_USER_EMAIL))
  }, [])

  if (!env.useMocks) {
    return (
      <AuthFrame onBack={back} backLabel="Back to map">
        <h1 className="heading-6">Not available</h1>
        <p className="body-6 mt-2 text-muted-foreground">Development sign-in only exists in mock mode.</p>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame onBack={back} backLabel="Cancel">
      <span aria-hidden className="grid size-12 place-items-center rounded-full bg-muted [&_svg]:size-6">
        <WrenchIcon weight="duotone" />
      </span>
      <p className="caption-4 mt-6 text-brand-ink">Development sign-in</p>
      <h1 className="heading-6 mt-1">Sign in as a test user</h1>
      <p className="body-6 mt-2 text-muted-foreground">
        Mock mode stands in for the university sign-in. No real account or password is used, and the session ends when you close the tab.
      </p>
      <form
        className="contents"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          // Checked here for a fast answer; the mock handler applies the same rule as the backend.
          if (!isAllowedEmail(email)) {
            setError(loginErrorMessage('domain'))
            return
          }
          setBusy(true)
          try {
            const { devSignIn } = await import('@/api/mocks/session')
            await devSignIn(email)
            await client.invalidateQueries({ queryKey: queryKeys.session })
            navigate(next, { replace: true })
          } catch (err) {
            setError(err instanceof ApiError && err.status === 403 ? loginErrorMessage('domain') : 'Sign in did not work. Try again.')
            setBusy(false)
          }
        }}
      >
        <label htmlFor="dev-email" className="title-4 mt-6">
          Test email
        </label>
        <input
          id="dev-email"
          data-testid="dev-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          spellCheck={false}
          value={email}
          aria-invalid={error ? true : undefined}
          aria-describedby="dev-email-hint"
          onChange={(e) => setEmail(e.target.value)}
          className="mt-2 min-h-12 w-full rounded-xl border border-input bg-card px-3 font-mono text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
        />
        <p id="dev-email-hint" className="body-6 mt-2 text-muted-foreground">
          Only @{ALLOWED_EMAIL_DOMAIN} addresses can sign in.
        </p>
        {error ? <InlineError testId="dev-sign-in-error">{error}</InlineError> : null}
        <Button type="submit" tone="brand" block className="mt-6" disabled={busy} data-testid="dev-sign-in">
          Sign in
        </Button>
      </form>
    </AuthFrame>
  )
}
