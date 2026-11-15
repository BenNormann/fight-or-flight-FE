import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/cn"

/** Placeholder line: snappy stagger. */
const PLACEHOLDER_STAGGER_SEC = 0.018
const PLACEHOLDER_CHAR_DURATION_SEC = 0.16

/** Loading line: longer, more deliberate reveal (parent can override). */
const DEFAULT_LOADING_STAGGER_SEC = 0.038
const DEFAULT_LOADING_CHAR_DURATION_SEC = 0.36

/** Clear control ↔ spinner crossfade / shared layout (ease-out ~200ms). */
const TRAILING_ACTION_DURATION_SEC = 0.2

/** Caps right-to-left deletion stagger so long clears stay snappy and teardown stays in sync. */
const DELETION_MAX_STAGGER_SPAN_SEC = 0.85

/**
 * Per-glyph blur timing for `DeletedTextBlurReveal` and `scheduleDeletionEnd`.
 * Compresses delay steps when `(staggerGlyphCount - 1) * step` would exceed the cap.
 */
function getDeletionGlyphTiming(args: {
  sweepDurationMs: number
  /** Drives speed curve (same as count of glyphs that participate in the effect). */
  animatedCount: number
  /** Full string length used for stagger delays (max index is `length - 1`). */
  staggerGlyphCount: number
}) {
  const sweepDurationSec = args.sweepDurationMs / 1000
  const animatedCount = Math.max(1, args.animatedCount)
  const staggerCount = Math.max(1, args.staggerGlyphCount)

  const normalizedLength = Math.min(1, Math.max(0, (animatedCount - 1) / 60))
  const easeOutLength = 1 - (1 - normalizedLength) ** 3
  const speedFactor = 1 - 0.6 * easeOutLength

  const glyphDurationSec = Math.max(
    0.12,
    Math.max(0.22, sweepDurationSec * 0.45) * speedFactor
  )
  let glyphDelayStepSec = Math.max(
    0.004,
    Math.max(0.012, sweepDurationSec * 0.03) * speedFactor
  )

  const gapCount = Math.max(0, staggerCount - 1)
  const uncappedStaggerSpan = gapCount * glyphDelayStepSec
  if (
    uncappedStaggerSpan > DELETION_MAX_STAGGER_SPAN_SEC &&
    uncappedStaggerSpan > 0
  ) {
    glyphDelayStepSec *= DELETION_MAX_STAGGER_SPAN_SEC / uncappedStaggerSpan
  }

  const staggerSpanSec = gapCount * glyphDelayStepSec
  return { glyphDurationSec, glyphDelayStepSec, staggerSpanSec }
}

interface HaloSearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void
  /**
   * Frosted, semi-transparent fill so animated gradient blobs show through more clearly.
   * Also applied automatically while `isLoading` (e.g. after submit until the request finishes).
   */
  blobTranslucent?: boolean
  /**
   * When true, query text is hidden and staggered loading copy is shown (same motion as
   * the placeholder). Parent typically toggles this during async submit.
   */
  isLoading?: boolean
  /** Copy shown while `isLoading`; defaults to “Searching…”. */
  loadingText?: string
  /** Delay between each loading character’s fade-in (seconds). Default 0.038. */
  loadingStaggerSec?: number
  /** Duration of each loading character’s fade-in (seconds). Default 0.36. */
  loadingCharDurationSec?: number
  /** Rendered before the input (icon). */
  leading?: ReactNode
  /** Rendered after the clear control (e.g. a profile button). */
  trailing?: ReactNode
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

/** Small indeterminate ring; Tailwind `animate-spin` avoids fighting parent `layoutId` transforms. */
function SearchFieldSpinner({
  className,
  reduceMotion,
}: {
  className?: string
  reduceMotion: boolean
}) {
  return (
    <span
      className={cn(
        "inline-flex origin-center text-muted-foreground",
        !reduceMotion && "animate-spin",
        className
      )}
    >
      <svg
        aria-hidden="true"
        className="h-3.5 w-3.5"
        focusable="false"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-[0.22]"
          cx="12"
          cy="12"
          fill="none"
          r="9"
          stroke="currentColor"
          strokeWidth="2.25"
        />
        <circle
          cx="12"
          cy="12"
          fill="none"
          r="9"
          stroke="currentColor"
          strokeDasharray="14 42"
          strokeLinecap="round"
          strokeWidth="2.25"
        />
      </svg>
    </span>
  )
}

const trailingMotionTransition = (reduceMotion: boolean) => ({
  duration: reduceMotion ? 0 : TRAILING_ACTION_DURATION_SEC,
  ease: "easeOut" as const,
})

const trailingCrossfade = (reduceMotion: boolean) => ({
  exit: {
    opacity: reduceMotion ? 1 : 0,
    scale: reduceMotion ? 1 : 0.88,
  },
  initial: {
    opacity: reduceMotion ? 1 : 0,
    scale: reduceMotion ? 1 : 0.88,
  },
})

function TrailingLoadingSlot({ reduceMotion }: { reduceMotion: boolean }) {
  const cross = trailingCrossfade(reduceMotion)
  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      aria-hidden
      className={cn(
        "absolute inset-0 flex items-center justify-center rounded-full",
        "pointer-events-none text-muted-foreground"
      )}
      exit={cross.exit}
      initial={cross.initial}
      key="trailing-loading"
      layoutId="halo-search-trailing"
      transition={trailingMotionTransition(reduceMotion)}
    >
      <SearchFieldSpinner reduceMotion={reduceMotion} />
    </motion.div>
  )
}

function TrailingClearSlot({
  reduceMotion,
  onClear,
}: {
  reduceMotion: boolean
  onClear: () => void
}) {
  const cross = trailingCrossfade(reduceMotion)
  return (
    <motion.button
      animate={{ opacity: 1, scale: 1 }}
      aria-label="Clear search"
      className={cn(
        "absolute inset-0 flex items-center justify-center rounded-full",
        "text-muted-foreground",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-2 focus-visible:outline-ring",
        "transition-[background-color,color] duration-200 ease-out"
      )}
      exit={cross.exit}
      initial={cross.initial}
      key="trailing-clear"
      layoutId="halo-search-trailing"
      onClick={onClear}
      transition={trailingMotionTransition(reduceMotion)}
      type="button"
    >
      <XIcon className="size-4" />
    </motion.button>
  )
}

function SearchTrailingAction({
  hasValue,
  isLoading,
  reduceMotion,
  onClear,
}: {
  hasValue: boolean
  isLoading: boolean
  reduceMotion: boolean
  onClear: () => void
}) {
  if (!(hasValue || isLoading)) {
    return null
  }

  return (
    <div className="relative size-tap shrink-0">
      <AnimatePresence initial={false} mode="popLayout">
        {isLoading ? (
          <TrailingLoadingSlot reduceMotion={reduceMotion} />
        ) : (
          <TrailingClearSlot onClear={onClear} reduceMotion={reduceMotion} />
        )}
      </AnimatePresence>
    </div>
  )
}

/** Overlay placeholder: each character fades in with a short stagger (re-mounted via `animateKey`). Text is foreground/70 (AA on card in both themes). */
function AnimatedPlaceholder({
  text,
  animateKey,
  reduceMotion,
  staggerSec = PLACEHOLDER_STAGGER_SEC,
  charDurationSec = PLACEHOLDER_CHAR_DURATION_SEC,
}: {
  text: string
  animateKey: number
  reduceMotion: boolean
  /** Seconds between starting each child’s entrance. */
  staggerSec?: number
  /** Seconds for each glyph’s opacity fade-in. */
  charDurationSec?: number
}) {
  // Keys like `a-0`, `a-1` so duplicate letters animate independently and remount cleanly.
  const chars = useMemo(() => {
    const counts = new Map<string, number>()

    return Array.from(text, (char) => {
      const count = counts.get(char) ?? 0
      counts.set(char, count + 1)
      return { char, key: `${char}-${count}` }
    })
  }, [text])

  return (
    <motion.span
      animate="visible"
      className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-foreground/70"
      initial="hidden"
      key={animateKey}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduceMotion ? 0 : staggerSec,
          },
        },
      }}
    >
      {chars.map((glyph) => (
        <motion.span
          className="inline-block whitespace-pre"
          key={glyph.key}
          transition={{
            duration: reduceMotion ? 0 : charDurationSec,
            ease: "easeOut",
          }}
          variants={{
            hidden: { opacity: reduceMotion ? 1 : 0 },
            visible: { opacity: 1 },
          }}
        >
          {glyph.char}
        </motion.span>
      ))}
    </motion.span>
  )
}

/*
 * Project trim (Odyssey): the Warp shader avatar, the looping hue
 * gradient rim and the typing-burst state were removed. Chrome is monochrome
 * and never loops (docs/DESIGN.md §1, §3.5). `leading` replaces the avatar.
 */
export function HaloSearchInput({
  className,
  value,
  onChange,
  onClear,
  onFocus,
  onBlur,
  placeholder = "Search",
  blobTranslucent = false,
  isLoading = false,
  loadingText = "Searching…",
  loadingStaggerSec = DEFAULT_LOADING_STAGGER_SEC,
  loadingCharDurationSec = DEFAULT_LOADING_CHAR_DURATION_SEC,
  leading,
  trailing,
  disabled,
  readOnly,
  ...props
}: HaloSearchInputProps) {
  const showBlobTranslucent = blobTranslucent || isLoading
  const [internalValue, setInternalValue] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  // While true, real input text is hidden and `DeletedTextBlurReveal` shows the last string.
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletionGhostText, setDeletionGhostText] = useState<string | null>(
    null
  )
  const [deletionIndexes, setDeletionIndexes] = useState<number[]>([])
  const [deletionKey, setDeletionKey] = useState(0)
  // Bumps `AnimatedPlaceholder`’s React key so the stagger runs again after a clear.
  const [placeholderAnimKey, setPlaceholderAnimKey] = useState(0)
  const [loadingAnimKey, setLoadingAnimKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const deletionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasDeletingRef = useRef(false)
  const wasLoadingRef = useRef(false)
  const reduceMotion = useReducedMotion() ?? false
  const deleteClipDurationMs = 340
  const deleteSweepDurationMs = deleteClipDurationMs + deleteClipDurationMs / 2

  const currentValue = value === undefined ? internalValue : value
  const hasValue = String(currentValue).length > 0

  useEffect(() => {
    return () => {
      if (deletionTimerRef.current) {
        clearTimeout(deletionTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (wasDeletingRef.current && !isDeleting && !hasValue) {
      setPlaceholderAnimKey((k) => k + 1)
    }
    wasDeletingRef.current = isDeleting
  }, [hasValue, isDeleting])

  useEffect(() => {
    if (isLoading && !wasLoadingRef.current) {
      setLoadingAnimKey((k) => k + 1)
    }
    wasLoadingRef.current = isLoading
  }, [isLoading])

  const scheduleDeletionEnd = useCallback(
    (deletedCount: number) => {
      if (deletionTimerRef.current) {
        clearTimeout(deletionTimerRef.current)
      }
      const { glyphDurationSec, staggerSpanSec } = getDeletionGlyphTiming({
        sweepDurationMs: deleteSweepDurationMs,
        animatedCount: deletedCount,
        staggerGlyphCount: deletedCount,
      })
      const totalGlyphRunMs = (staggerSpanSec + glyphDurationSec) * 1000
      const teardownDelayMs =
        Math.max(deleteSweepDurationMs, totalGlyphRunMs) + 160

      deletionTimerRef.current = setTimeout(() => {
        setIsDeleting(false)
        setDeletionGhostText(null)
        setDeletionIndexes([])
        deletionTimerRef.current = null
      }, teardownDelayMs)
    },
    [deleteSweepDurationMs]
  )

  const startDeletion = (prev: string) => {
    setDeletionIndexes(Array.from({ length: prev.length }, (_, idx) => idx))
    setDeletionGhostText(prev)
    setDeletionKey((k) => k + 1)
    setIsDeleting(true)
    scheduleDeletionEnd(prev.length)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const prevValue = String(currentValue)
    if (e.target.value.length === 0 && prevValue.length > 0 && !reduceMotion) {
      startDeletion(prevValue)
    }
    if (onChange) {
      onChange(e)
    } else {
      setInternalValue(e.target.value)
    }
  }

  const handleClear = () => {
    if (hasValue && !reduceMotion) {
      startDeletion(String(currentValue))
    }
    if (onClear) {
      onClear()
    } else {
      setInternalValue("")
    }
    inputRef.current?.focus()
  }

  return (
    <div className={cn("relative w-full", className)}>
      <div
        aria-busy={isLoading || undefined}
        className={cn(
          "relative flex min-h-tap items-center gap-2 rounded-full pr-1 pl-4",
          /* Opaque card. Over the map: shadow-float (has its own casing). In a panel: border. Never both. */
          "bg-card transition-[box-shadow,border-color] duration-200",
          showBlobTranslucent ? "shadow-float" : "border border-border",
          isFocused && (showBlobTranslucent ? "inset-ring inset-ring-input" : "border-input")
        )}
      >
        {leading}

        <div className="relative min-w-0 flex-1 self-stretch">
          <input
            {...props}
            className={cn(
              "h-full min-h-12 w-full bg-transparent text-base text-foreground outline-none",
              "caret-foreground",
              /* One clear control: hide the native search cancel button (the custom X stays). */
              "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none",
              (isDeleting || isLoading) && "text-transparent caret-transparent"
            )}
            disabled={disabled}
            onBlur={(e) => {
              setIsFocused(false)
              onBlur?.(e)
            }}
            onChange={handleChange}
            onFocus={(e) => {
              setIsFocused(true)
              onFocus?.(e)
            }}
            placeholder=""
            aria-label={props["aria-label"] ?? placeholder}
            readOnly={readOnly || isLoading}
            ref={inputRef}
            type="search"
            value={currentValue}
          />
          {isLoading && (
            <AnimatedPlaceholder
              animateKey={loadingAnimKey}
              charDurationSec={loadingCharDurationSec}
              reduceMotion={reduceMotion}
              staggerSec={loadingStaggerSec}
              text={loadingText}
            />
          )}
          {!(hasValue || isDeleting || isLoading) && (
            <AnimatedPlaceholder
              animateKey={placeholderAnimKey}
              reduceMotion={reduceMotion}
              text={placeholder}
            />
          )}
          <AnimatePresence>
            {isDeleting && deletionGhostText !== null && (
              <DeletedTextBlurReveal
                animatedIndexes={deletionIndexes}
                clipDurationMs={deleteClipDurationMs}
                key={deletionKey}
                reduceMotion={reduceMotion}
                showSweep={false}
                text={deletionGhostText}
                textClassName="text-foreground"
              />
            )}
          </AnimatePresence>
        </div>

        <SearchTrailingAction
          hasValue={hasValue}
          isLoading={isLoading}
          onClear={handleClear}
          reduceMotion={reduceMotion}
        />
        {trailing}
      </div>
    </div>
  )
}


interface DeletedTextBlurRevealProps {
  text: string
  animatedIndexes?: number[]
  reduceMotion?: boolean
  className?: string
  textClassName?: string
  clipDurationMs?: number
  blurPx?: number
  saturatePercent?: number
  /** Optional diagonal blur “wiper” (disabled in the search field for a simpler exit). */
  showSweep?: boolean
}

/**
 * Absolute overlay: clones the string as per-glyph spans, blurs/fades them on a delay
 * (right-to-left), optionally with a masked backdrop-blur sweep and soft-light noise strip.
 */
export function DeletedTextBlurReveal({
  text,
  animatedIndexes,
  reduceMotion = false,
  className,
  textClassName,
  clipDurationMs = 340,
  blurPx = 10,
  saturatePercent = 220,
  showSweep = true,
}: DeletedTextBlurRevealProps) {
  const noiseFilterId = useId()
  const sweepDurationMs = clipDurationMs + clipDurationMs / 2
  // Per character + stable key; `order` is index for stagger math.
  const glyphs = useMemo(() => {
    const counts = new Map<string, number>()
    let order = 0

    return Array.from(text, (char) => {
      const count = counts.get(char) ?? 0
      counts.set(char, count + 1)

      const glyph = {
        char,
        key: `${char}-${count}`,
        order,
        index: order,
      }

      order += 1
      return glyph
    })
  }, [text])
  // `null` set means animate every glyph; otherwise only indices in the set animate to blurred state.
  const animatedIndexSet = useMemo(() => {
    if (!animatedIndexes || animatedIndexes.length === 0) {
      return null
    }
    return new Set(animatedIndexes)
  }, [animatedIndexes])
  const animatedCount =
    animatedIndexes && animatedIndexes.length > 0
      ? animatedIndexes.length
      : glyphs.length
  const { glyphDurationSec, glyphDelayStepSec } = getDeletionGlyphTiming({
    sweepDurationMs,
    animatedCount,
    staggerGlyphCount: glyphs.length,
  })

  return (
    <motion.div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 isolate", className)}
      exit={{
        opacity: 0,
        transition: {
          duration: reduceMotion ? 0 : 0.12,
          delay: reduceMotion ? 0 : 0.22,
          ease: "easeOut",
        },
      }}
      initial={{
        opacity: 1,
      }}
      style={{
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div className="absolute inset-y-0 left-0 flex w-fit max-w-full overflow-hidden">
        <motion.div
          animate={{ clipPath: "inset(0 0 0 0 round 9999px)" }}
          className="relative h-full w-fit max-w-full overflow-hidden"
          initial={{ clipPath: "inset(0 0 0 0 round 9999px)" }}
          transition={{
            duration: 0,
            ease: "easeOut",
          }}
        >
          <span
            className={cn(
              "relative z-10 block min-w-0 select-none text-base text-current",
              textClassName
            )}
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              whiteSpace: "pre",
            }}
          >
            {glyphs.map((glyph) => (
              <motion.span
                animate={
                  animatedIndexSet === null || animatedIndexSet.has(glyph.index)
                    ? {
                        opacity: 0.04,
                        filter: "blur(10px)",
                        y: -1,
                      }
                    : {
                        opacity: 1,
                        filter: "blur(0px)",
                        y: 0,
                      }
                }
                className="inline-block"
                initial={{
                  opacity: 1,
                  filter: "blur(0px)",
                  y: 0,
                }}
                key={glyph.key}
                transition={{
                  duration:
                    reduceMotion ||
                    (animatedIndexSet && !animatedIndexSet.has(glyph.index))
                      ? 0
                      : glyphDurationSec,
                  ease: "easeOut",
                  // End of string animates first (higher `order` → smaller delay expression).
                  delay: reduceMotion
                    ? 0
                    : (glyphs.length - 1 - glyph.order) * glyphDelayStepSec,
                }}
              >
                {glyph.char === " " ? "\u00A0" : glyph.char}
              </motion.span>
            ))}
          </span>

          {/* Moving soft mask + backdrop blur; gradient mask feathers the strip edges. */}
          {showSweep && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <motion.div
                animate={{ x: "-125%" }}
                className="-right-8 absolute inset-y-0 w-24"
                initial={{ x: "125%" }}
                style={{
                  backdropFilter: `blur(${blurPx}px) saturate(${saturatePercent}%)`,
                  WebkitBackdropFilter: `blur(${blurPx}px) saturate(${saturatePercent}%)`,
                  maskImage:
                    "linear-gradient(to right, rgb(0 0 0 / 1) 70%, transparent)",
                  WebkitMaskImage:
                    "linear-gradient(to right, rgb(0 0 0 / 1) 70%, transparent)",
                }}
                transition={{
                  duration: reduceMotion ? 0 : sweepDurationMs / 1000,
                  ease: "easeOut",
                }}
              />

              {/* Fractal noise rect adds grain along the sweep (soft-light blend). */}
              <motion.svg
                animate={{ x: "-125%", opacity: 0 }}
                aria-hidden="true"
                className="-right-8 absolute inset-y-0 h-full w-24 mix-blend-soft-light"
                focusable="false"
                initial={{ x: "125%", opacity: 0.08 }}
                style={{
                  maskImage:
                    "linear-gradient(to right, rgb(0 0 0 / 1) 72%, transparent)",
                  WebkitMaskImage:
                    "linear-gradient(to right, rgb(0 0 0 / 1) 72%, transparent)",
                }}
                transition={{
                  duration: reduceMotion ? 0 : sweepDurationMs / 1000,
                  ease: "easeOut",
                }}
              >
                <filter id={noiseFilterId}>
                  <feTurbulence
                    baseFrequency="0.85"
                    numOctaves="2"
                    stitchTiles="stitch"
                    type="fractalNoise"
                  />
                  <feColorMatrix type="saturate" values="0" />
                </filter>
                <rect
                  filter={`url(#${noiseFilterId})`}
                  height="100%"
                  width="100%"
                />
              </motion.svg>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
