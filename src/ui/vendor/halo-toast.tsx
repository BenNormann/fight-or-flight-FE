/**
 * Cult UI Halo Toast, trimmed for Fight or Flight.
 *
 * Removed from upstream: hue gradient rim blobs, the looping border trail, the
 * per-glyph stagger and the Next.js-only `<style jsx>` block. Toasts are never
 * the showpiece (docs/DESIGN.md §3), so the card is a flat monochrome surface
 * and Sonner's own enter/exit is the only motion.
 */
import type { ComponentProps } from "react"
import type { ExternalToast } from "sonner"
import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner"
import "sonner/dist/styles.css"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/cn"
import { Button } from "@/ui/vendor/button"

export interface PolishedToastSurfaceProps {
  title: string
  description?: string
  politeness?: "status" | "alert"
  /** Optional leading icon. */
  icon?: React.ReactNode
  /** Sonner toast id from `toast.custom((id) => …)`; required for the dismiss control. */
  toastId?: number | string
  closeButton?: boolean
  className?: string
}

export function PolishedToastSurface({
  title,
  description,
  politeness = "status",
  icon,
  toastId,
  closeButton = false,
  className,
}: PolishedToastSurfaceProps) {
  return (
    <div
      aria-live={politeness === "alert" ? "assertive" : "polite"}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border border-border bg-glass py-3 pr-1 pl-4 text-left shadow-overlay backdrop-blur-glass",
        className
      )}
      role={politeness === "alert" ? "alert" : "status"}
    >
      {icon ? (
        <span aria-hidden className="mt-0.5 shrink-0 text-muted-foreground [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1 space-y-0.5 py-0.5">
        <p className="text-balance font-medium text-foreground text-sm">{title}</p>
        {description ? (
          <p className="text-pretty text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {closeButton && toastId != null ? (
        <Button
          aria-label="Dismiss"
          className="-my-2 size-tap shrink-0 rounded-full p-0 text-muted-foreground"
          onClick={() => {
            sonnerToast.dismiss(toastId)
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}

export type PolishedToastOptions = Omit<ExternalToast, "description" | "icon"> & {
  title: string
  description?: string
  politeness?: "status" | "alert"
  icon?: React.ReactNode
}

export function showPolishedToast(options: PolishedToastOptions) {
  const {
    title,
    description,
    politeness = "status",
    icon,
    duration,
    closeButton = true,
    className: toastClassName,
    ...rest
  } = options

  return sonnerToast.custom(
    (id) => (
      <PolishedToastSurface
        closeButton={closeButton}
        description={description}
        icon={icon}
        politeness={politeness}
        title={title}
        toastId={id}
      />
    ),
    {
      duration: duration ?? 4000,
      ...rest,
      className: cn("w-full", toastClassName),
    }
  )
}

export function PolishedToaster({
  className,
  ...props
}: ComponentProps<typeof SonnerToaster>) {
  return (
    <SonnerToaster
      className={cn("toaster group", className)}
      gap={8}
      position="top-center"
      {...props}
    />
  )
}
