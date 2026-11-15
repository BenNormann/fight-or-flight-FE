import { GlobeIcon, MapPinIcon, NavigationArrowIcon, PhoneIcon, ShareNetworkIcon, StarIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { WEEKDAYS, type Id, type OpenSpan, type PlaceDetail, type Weekday } from '@/domain'
import { cn } from '@/lib/cn'
import { distanceText } from '@/lib/units'
import { usePlaceById } from '@/state/places'
import { useAppStore } from '@/state/store'
import { ActionBar, Button, EmptyState, Section, ViewHeader, notify, type ActionItem } from '@/ui'

const DAY_LABEL: Record<Weekday, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' }
/** JS `getDay()` is Sunday-first; the backend's week starts on Monday. */
const today = (): Weekday => WEEKDAYS[(new Date().getDay() + 6) % 7]!

/** "08:00" -> "8 AM", "17:30" -> "5:30 PM". */
function clock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return hhmm
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h % 24 < 12 ? 'AM' : 'PM'}`
}

const spanText = (s: OpenSpan) => (s.allDay ? 'Open 24 hours' : `${clock(s.open)} to ${clock(s.close)}`)
const dayText = (spans: OpenSpan[]) => (spans.length ? spans.map(spanText).join(', ') : 'Closed')

const label = (slug: string | undefined) => {
  if (!slug) return undefined
  const s = slug.replace(/[_-]+/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function share(title: string) {
  const url = window.location.href
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => undefined)
    return
  }
  navigator.clipboard
    ?.writeText(url)
    .then(() => notify({ id: 'share', title: 'Link copied', description: title }))
    .catch(() => notify({ id: 'share', title: 'Could not copy the link', description: 'Copy it from the address bar instead.' }))
}

/** Open or closed, as text (never colour alone), with today's hours when known. */
function OpenLine({ openNow, hours }: Pick<PlaceDetail, 'openNow' | 'hours'>) {
  const todays = hours?.[today()]
  if (openNow == null && !todays) return null
  return (
    <span className={cn('inline-flex items-center gap-2', openNow ? 'text-foreground' : 'text-muted-foreground')} data-testid="place-open">
      {openNow ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-gold" /> : null}
      {[openNow == null ? null : openNow ? 'Open now' : 'Closed now', todays ? dayText(todays) : null].filter(Boolean).join(' · ')}
    </span>
  )
}

function Rating({ rating, reviewCount }: { rating: number; reviewCount?: number }) {
  return (
    <p className="body-3 mt-4 flex items-center gap-2" data-testid="place-rating" aria-label={`Rated ${rating.toFixed(1)} out of 5${reviewCount ? `, ${reviewCount} reviews` : ''}`}>
      <StarIcon aria-hidden weight="fill" className="size-5 text-gold" />
      <span className="font-mono">{rating.toFixed(1)}</span>
      {reviewCount ? <span className="body-6 text-muted-foreground">{reviewCount.toLocaleString()} reviews</span> : null}
    </p>
  )
}

/** A business or campus place from the backend: what it is, whether it is open, how to reach it. */
export function BusinessDetail({ id }: { id: Id }) {
  const back = useAppStore((s) => s.back)
  const directionsTo = useAppStore((s) => s.directionsTo)
  const { place, detail, loading, missing } = usePlaceById(id)
  const [photoFailed, setPhotoFailed] = useState(false)

  if (!place) {
    return (
      <div data-testid="view-place">
        <ViewHeader title={loading && !missing ? 'Loading place…' : 'Place not found'} onBack={back} />
        {loading && !missing ? (
          <div aria-busy="true" className="grid gap-3">
            <div className="h-tap w-40 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            <div className="h-32 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
          </div>
        ) : (
          <EmptyState icon={<MapPinIcon weight="duotone" />} title="This place is not on the map" body="The link may be out of date. Search for it by name instead." action={<Button onClick={back}>Back to the map</Button>} />
        )}
      </div>
    )
  }

  const actions: ActionItem[] = [
    { id: 'dir', label: 'Directions', icon: <NavigationArrowIcon weight="fill" />, primary: true, onClick: () => directionsTo(place.id) },
    ...(detail?.phone ? [{ id: 'call', label: 'Call', icon: <PhoneIcon />, onClick: () => window.location.assign(`tel:${detail.phone!.replace(/[^\d+]/g, '')}`) }] : []),
    ...(detail?.website ? [{ id: 'web', label: 'Website', icon: <GlobeIcon />, onClick: () => window.open(detail.website, '_blank', 'noopener,noreferrer') }] : []),
    { id: 'share', label: 'Share', icon: <ShareNetworkIcon />, onClick: () => share(place.name) },
  ]
  const kindLine = [label(place.subcategory) ?? label(place.category) ?? (place.kind === 'building' ? 'Building' : 'Place'), place.distanceM != null ? distanceText(place.distanceM) : null]
    .filter(Boolean)
    .join(' · ')
  const day = today()
  // Campus buildings are known by a short code; show it like the campus signs do.
  const code = detail?.aliases.find((a) => /^[A-Z]{2,4}$/.test(a))

  return (
    <div data-testid="view-place" data-place-kind={place.kind}>
      <ViewHeader
        eyebrow={
          code ? (
            <>
              {kindLine} · <span className="font-mono">{code}</span>
            </>
          ) : (
            kindLine
          )
        }
        title={place.name}
        subtitle={
          <>
            <OpenLine openNow={detail?.openNow ?? place.openNow} hours={detail?.hours} />
            {place.address ? <span className="block">{place.address}</span> : null}
          </>
        }
        onBack={back}
      />
      <ActionBar actions={actions} />

      {detail?.photoUrl && !photoFailed ? (
        <img
          src={detail.photoUrl}
          alt=""
          loading="lazy"
          // Photos are hot-linked from the place's source: send no referrer, and drop the frame if it does not load.
          referrerPolicy="no-referrer"
          onError={() => setPhotoFailed(true)}
          className="mt-4 aspect-video w-full rounded-2xl bg-muted object-cover"
        />
      ) : null}

      {place.rating ? <Rating rating={place.rating} reviewCount={place.reviewCount} /> : null}
      {detail?.description ? <p className="body-6 mt-3 text-muted-foreground">{detail.description}</p> : null}

      {detail?.hours ? (
        <Section className="mt-6" title="Hours">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1" data-testid="place-hours">
            {WEEKDAYS.map((d) => (
              <div key={d} className={cn('col-span-2 grid grid-cols-subgrid py-1', d === day ? 'title-3' : 'body-6 text-muted-foreground')}>
                <dt>{DAY_LABEL[d]}</dt>
                <dd className="font-mono">{dayText(detail.hours![d])}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      {detail?.phone || detail?.website ? (
        <Section className="mt-6" title="Contact">
          {detail.phone ? (
            <p className="body-3 flex min-h-tap items-center gap-3">
              <PhoneIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              <a className="rounded underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" href={`tel:${detail.phone.replace(/[^\d+]/g, '')}`}>
                {detail.phone}
              </a>
            </p>
          ) : null}
          {detail.website ? (
            <p className="body-3 flex min-h-tap items-center gap-3">
              <GlobeIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              <a
                className="min-w-0 truncate rounded underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                href={detail.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                {new URL(detail.website).hostname.replace(/^www\./, '')}
              </a>
            </p>
          ) : null}
        </Section>
      ) : null}

      {detail?.reviews.length ? (
        <Section className="mt-6" title="What people say">
          <ul className="grid gap-3" data-testid="place-reviews">
            {detail.reviews.slice(0, 3).map((r, i) => (
              <li key={i} className="rounded-2xl border border-border bg-card p-3">
                <p className="caption-4 flex items-center gap-2 text-muted-foreground">
                  {r.rating ? (
                    <span className="inline-flex items-center gap-1 text-foreground">
                      <StarIcon aria-hidden weight="fill" className="size-3.5 text-gold" />
                      <span className="font-mono">{r.rating}</span>
                    </span>
                  ) : null}
                  {[r.author, r.when].filter(Boolean).join(' · ')}
                </p>
                <p className="body-6 mt-1 line-clamp-4">{r.text}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  )
}
