# Odyssey — Component sources

One library component per UI slot. Everything lands in `src/ui/vendor/` through the shadcn CLI and is wrapped once in `src/ui/`. Checked 2026-11-14 by fetching each item's registry JSON (dependencies, imports and source read). Nothing was installed and the CLI was not run, see "Unverified".

Registries: Cult `https://www.cult-ui.com/r/<name>.json` (307 items, all free) · Watermelon `https://registry.watermelon.sh/r/<name>.json` (1178 items, all free) · Skiper `https://skiper-ui.com/registry/<id>.json` (37 free ids listed in `registry.json`; every other id returns 404, treat as paid) · shadcn `https://ui.shadcn.com/r/styles/<style>/<name>.json`.

**shadcn style note.** `components.json` is `new-york`, whose items now import the unified `radix-ui` package (not installed). The `base-nova` style of the same items imports `@base-ui/react` (installed). Install shadcn items by `base-nova` URL to add no dependency. Short form below: `SHADCN=https://ui.shadcn.com/r/styles/base-nova`.

## Slots

| Slot | Component | Install | Cost | Adds deps | Adaptation |
|---|---|---|---|---|---|
| Filter chips, horizontal scroll with edge fade | Watermelon `scroll-fade` wrapping the existing chip (shadcn `button`) | `npx shadcn@latest add https://registry.watermelon.sh/r/scroll-fade.json` | Free | None | Fades are solid `var(--background)` gradient overlays, wrong over a live map: replace with a `mask-image` on the scroller. Fade width 40px, keep. Installs to a `watermelon-ui` path, move to `ui/vendor`. |
| Switch / toggle rows | Cult `halo-switch` inside a shadcn `item` row | `pnpm dlx shadcn@latest add @cult-ui/halo-switch` | Free | None (`@base-ui/react`, `motion` present) | Remove pink / purple / cyan rim gradients (chrome is monochrome). Already `motion/react`, respects reduced motion. Row must be 44px. |
| Segmented control | Cult `halo-segmented` | Installed (`vendor/halo-segmented.tsx`) | Free | None | Done: hue rim removed, thumb is a shared layout element. |
| Tabs | Cult `halo-tabs` | `pnpm dlx shadcn@latest add @cult-ui/halo-tabs` | Free | None (`@base-ui/react`) | Indicator uses a CSS transition on `left, width, top, height`: swap for the transform thumb used in halo-segmented. Remove gradient glow. |
| Search field with results list | Cult `halo-search` + results as shadcn `item` rows | Installed (`vendor/halo-search.tsx`); rows as below | Free | None | Done: shader, hue rim, typing state removed (upstream needs `@paper-design/shaders-react`, keep it out). Results list has no keyboard roving focus; add arrow keys in `ui/SearchBar`. |
| Bottom sheet multi-step content | Cult `family-drawer` | `pnpm dlx shadcn@latest add @cult-ui/family-drawer` | Free | None (`vaul`, `react-use-measure`, `motion`, `@radix-ui/react-slot` present) | Animates `height` from `useMeasure` on every view change: drop that, sheet height belongs to `store.sheetSnap`. Use only `AnimatedWrapper` / `AnimatedContent` / `ViewContent` inside `ui/BottomSheet`; do not mount its own Drawer root or overlay (ours is non-modal). |
| Side panel (desktop) | Cult `side-panel` | `pnpm dlx shadcn@latest add @cult-ui/side-panel` | Free | None | Heavy: animates `width` to 97% and `height`, hard-coded `bg-neutral-900`, unused `videoUrl` prop. Rewrite motion to `translateX`, fixed 400px. Little upstream code survives; current `ui/SidePanel` is the fallback. |
| Toast | Cult `halo-toast` (Sonner) | Installed (`vendor/halo-toast.tsx`) | Free | None | Done: rim blobs, border trail, glyph stagger and `<style jsx>` removed. |
| Active route status pill | Cult `halo-badge` + shadcn `badge` | `pnpm dlx shadcn@latest add $SHADCN/badge.json` then `pnpm dlx shadcn@latest add @cult-ui/halo-badge` | Free | None with `base-nova` badge | Imports `badgeVariants` from the shadcn badge. `live` dot is a repeating opacity pulse: turn off (no loops). Remove gradient rim. Uses `layout` for expand, transform only. |
| List rows | shadcn `item` | `pnpm dlx shadcn@latest add $SHADCN/separator.json $SHADCN/item.json` | Free | None | Min height 44px, named text styles from tokens. |
| Cards | shadcn `card` | `pnpm dlx shadcn@latest add $SHADCN/card.json` | Free | None | Radius `2xl`, flat background. |
| Primary / secondary / icon buttons | shadcn `button` | Installed (`vendor/button.tsx`) | Free | None | Add press `scale(0.98)` and `brand` variant in the wrapper. |
| Floating action button | shadcn `button` (round, 56px) | Installed | Free | None | No free FAB fits. Wrapper adds `fab` size, safe-area offset. |
| Time slider / scrubber | shadcn `slider` (Base UI) | `pnpm dlx shadcn@latest add $SHADCN/slider.json` | Free | None | Thumb hit area to 44px, tick marks and mono time label in the wrapper. |
| Skeleton / loading | shadcn `skeleton` | `pnpm dlx shadcn@latest add $SHADCN/skeleton.json` | Free | None | Remove `animate-pulse` (skeletons are static). |
| Empty state | shadcn `empty` | `pnpm dlx shadcn@latest add $SHADCN/empty.json` | Free | None | None beyond tokens. |
| Tooltip (desktop) | Cult `base-tooltip` | `pnpm dlx shadcn@latest add @cult-ui/base-tooltip` | Free | None (`@base-ui/react`, `@radix-ui/react-slot`) | Render only at ≥ 1024 and on hover-capable pointers. |
| Number / ETA count-up | Cult `rolling-number` | `pnpm dlx shadcn@latest add @cult-ui/rolling-number` | Free | None (`motion`) | 1 KB spring on a motion value. Add reduced-motion jump, `tabular-nums` Geist Mono, pass `format` from `ui/format`. |

Every Cult item above already imports `motion/react` and `cn` from `@/lib/utils` (the CLI rewrites to `@/lib/cn`). None imports from `next/*`. `"use client"` lines are harmless in Vite.

## Looked at and rejected

| Component | Why |
|---|---|
| Cult `dynamic-island` | 25 animated width / height values, hard-coded black, `any` props (as DESIGN.md §3). |
| Cult `family-button` (FAB) | Expands by animating `width` / `height`, gradient fills. |
| Cult `direction-aware-tabs` | Animates `height`, blur filter on every change. |
| Cult `halo-button`, `halo-card` | 14 KB and 22 KB of rim and trail effects that would all be stripped. |
| Cult `minimal-card` | Imports `next/image`. |
| Watermelon `scrub-slider` | No keyboard or ARIA, animates `left`, hard-coded "°C" and gray palette, no `value` / `onChange` props. |
| Watermelon `tags`, `filter-disclosure`, `command-search`, `continuous-tabs` | Demo components with built-in sample data; several need `react-icons`. |
| Watermelon `status-indicator` | Looping `animate-ping`, hard-coded green / red / yellow (hue is reserved for risk). |
| Watermelon `sidebar`, `tabs`, `toggle-group` | 25 to 43 KB each, need `@floating-ui/react` or `radix-ui`. |
| Skiper `skiper87` (scroll fade) | Source is only a shadcn ScrollArea demo, no fade logic; declares `framer-motion`. |
| Skiper `skiper37` (animated number) | Needs `@number-flow/react`, `framer-motion`, `react-intersection-observer`. |
| Skiper `skiper101` (tooltip) | Needs `@radix-ui/react-tooltip`; Cult `base-tooltip` adds nothing. |
| shadcn `command` | Adds `cmdk` and `dialog`; bundle is already over budget. |

No Skiper component is used. All free Skiper ids that touch motion import `framer-motion`, which would need rewriting to `motion/react`.

## Unverified

- The CLI was not run. Whether `@cult-ui/<name>` resolves without a `registries` entry in `components.json` is untested; the URL form `https://www.cult-ui.com/r/<name>.json` is the fetched one and is the safe fallback.
- `item` declares `separator` and `halo-badge` declares `badge` as registry dependencies by bare name. The CLI may resolve those against the `new-york` style and pull the `radix-ui` variants even after the `base-nova` files exist. Install the `base-nova` file first and decline the overwrite; if it cannot be declined, `radix-ui` becomes a required new dependency.
- Mixing `base-nova` items into a `new-york` project by URL is assumed to work (same tokens); visual differences were not checked.
- "Paid" for Skiper is inferred from ids missing from its public `registry.json` and returning 404.
- Bundle cost and 390 / 360 rendering of the new items were not measured.
