# Fight or Flight — Design

Tokens live in `src/styles/tokens.css` (import after `@import "tailwindcss"`). Researched 2026-11-14. Design at 390×844, night theme first.

## 1. Token rationale

- **Monochrome chrome, hue is data.** Surfaces, text, primary buttons and the focus ring are neutral greys. The only hues on screen are the five risk bands and `destructive` (SOS, errors). This keeps the map the star and stops chrome from competing with risk colour.
- **Night surfaces** are flat, no gradients: `#181818` background, `#1F1F1F` card and sheet, `#272727` muted, `#313131` hairline. Floating chrome over the map uses `bg-glass` + `backdrop-blur-glass`. In the night theme elevation is a 1px light hairline plus shadow, because shadow alone disappears on dark.
- **Risk bands** `--risk-1..5` (1 lowest) each have a `-foreground`. Hue runs blue → cyan → yellow → orange → magenta, so no red against green pair. Computed, both themes: fill ≥ 3:1 on background, card and muted (lowest 3.03, light band 2 on muted); foreground on fill ≥ 4.5:1 (lowest 5.1). Simulated protan, deutan and tritan (Machado 2009): every pair of bands stays apart, lowest ΔE76 is 16 (light, bands 1 and 2, tritan) and 17 (light, bands 3 and 4, deutan). Those two pairs are the reason a label or icon from `src/lib/risk.ts` is mandatory. `risk.ts` should read these variables, not restate hex.
- **Type**: Geist only, Geist Mono for numeric UI (ETA, distance, score). Tailwind steps `xs` to `3xl`, weights 400/500/600. Inputs stay at 16px so iOS does not zoom.
- **Spacing**: 4px base, allowed steps 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 px. Named: `tap` 44px, `fab` 56px, `gutter` 16px, `sheet-peek` 96px. Safe areas via `--safe-*`.
- **Radius**: Tailwind's own steps. Chips and FABs `full`, controls `xl` (12), cards `2xl` (16), sheet top `3xl` (24). Nested: inner = outer − gap.
- **Shadows**: `shadow-raised`, `shadow-float` (search, FABs), `shadow-overlay`, `shadow-sheet` (casts upward).
- **Buildings**: six low chroma materials (`--bldg-*`), baked into GLBs, so they do not switch with theme. Selection is a deck.gl tint from `--ring`, not a material.

## 2. Slot → component

All registry JSON below was fetched without credentials on the research date; "free" means it was served with no licence key. Wrap every one in `src/ui/`, file lands in `src/ui/vendor/`.

| Slot | Component | Install (verified) | Status | Brings in |
|---|---|---|---|---|
| Bottom sheet | shadcn Drawer | `pnpm dlx shadcn@latest add drawer` | Free. Command from ARCHITECTURE §2, not re-fetched | `vaul` |
| Search bar | Cult Halo Search | `pnpm dlx shadcn@latest add @cult-ui/halo-search` | Free | `motion`, `@paper-design/shaders-react` |
| Multi step sheet content | Cult Family Drawer | `pnpm dlx shadcn@latest add @cult-ui/family-drawer` | Free | `motion`, `vaul`, `react-use-measure`, `@radix-ui/react-slot` |
| Active route pill | Cult Dynamic Island | `pnpm dlx shadcn@latest add @cult-ui/dynamic-island` | Free | `motion` |
| Toast | Cult Halo Toast | `pnpm dlx shadcn@latest add @cult-ui/halo-toast` | Free | `sonner`, `motion`, `lucide-react`, shadcn `button` |
| Camera mode 2D / iso / 3D | Cult Halo Segmented | `pnpm dlx shadcn@latest add @cult-ui/halo-segmented` | Free | `@base-ui/react`, `motion` |
| Layer and sheet tabs | Cult Direction Aware Tabs | `pnpm dlx shadcn@latest add @cult-ui/direction-aware-tabs` | Free | `motion`, `react-use-measure` |
| ETA and distance count up | Skiper `skiper37` | `npx shadcn add @skiper-ui/skiper37` | Free | `framer-motion` |
| Sheet list edge fade | Skiper `skiper87` | `npx shadcn add @skiper-ui/skiper87` | Free | `framer-motion` |
| Leave at time scrubber (optional) | Watermelon `scrub-slider` | `npx shadcn@latest add https://registry.watermelon.sh/r/scrub-slider.json` | Free, MIT repo | `motion` |
| FAB, Chip, Legend | Ours, built on shadcn `button` / `badge` | n/a | n/a | none |

Registry facts:
- **Cult UI**: `@cult-ui` namespace resolves with no config on shadcn CLI ≥ 3.0 (`https://www.cult-ui.com/r/{name}.json`). All six import `motion/react`, none import `next/*`. No paid markers on any component; the only paid product is the separate "AI SDK Agents" block pack.
- **Skiper UI**: of ids `skiper1` to `skiper107`, 37 are free, 69 return `401 Missing license key`, 1 (`skiper93`) does not exist. Paid tier: Premium $129 one time, needs `SKIPER_LICENSE_KEY` and a `registries` header entry in `components.json`. **`skiper2` (Dynamic Island) is labelled "Free Component" on the homepage but its registry URL returns 401**, so treat it as paid and use Cult's. Free ones import `framer-motion`; the wrapper pass must change that to `motion/react` (project invariant). Their docs give two different output paths, so pass `--path src/ui/vendor` or move the file.
- **Watermelon UI**: no namespace. Install by URL as above, pattern confirmed by the repo README, the public catalog API `installCommand` field, and a 200 from the registry. `registry.watermelon.sh/registry.json` lists 1178 items. Free, repo is MIT. Many items pull `react-icons`; check before adopting.
- **manus.im**: inspiration only. Takeaways used here: one short confident line of copy per surface, pill suggestion chips, low density header, nothing decorative.

## 3. Motion rules

1. `motion` only. Animate `transform` and `opacity`, never `top`, `left`, `width`, `height`.
2. Base curve `ease-settle` (`cubic-bezier(0.22, 1, 0.36, 1)`). Colour and opacity `--duration-fast` 200ms, small transforms `--duration-base` 300ms, layout and position `--duration-slow` 500ms. `ease-emphasis` is for the showpiece only.
3. **One showpiece per screen.** Everything else is a 200ms fade or press scale (0.98).

| Screen state | Showpiece | Everything else |
|---|---|---|
| Map idle | Camera flight between 2D / iso / 3D | Segmented thumb slides, no bounce |
| Search open | Halo Search focus and expand | Results fade in, no stagger past 400ms total |
| Building / room sheet | Family Drawer view morph between steps | Tabs cross fade |
| Route active | Dynamic Island expand and collapse | Route line draws once, no loop |
| Any | Toasts are never the showpiece | |

4. **Reduced motion**: tokens set `--motion-distance: 0px`, `--motion-scale: 0`, and collapse durations to 200ms. Components must multiply travel by `--motion-scale` and use `useReducedMotion()` to swap movement for opacity. Camera changes jump (`duration: 0`). Turn off Halo Search's shader and gradient border.
5. No looping or ambient animation on chrome. The SOS FAB never pulses.

## 4. Unverified / flagged

- `tokens.css` has not been compiled: there was no `package.json` or entry stylesheet when it was written. Tailwind v4 syntax is from memory of the v4 docs.
- No Cult, Skiper or Watermelon component was installed or rendered. Bundle cost, React 19 behaviour and 390px layout are untested. Component licences were not read (only Watermelon's repo licence, MIT, was seen).
- **Halo Search** is a 32 KB source file with a WebGL shader avatar dependency. Likely too heavy for the 200 KB budget and too loud for calm chrome; expect to strip the shader or fall back to a plain shadcn input.
- **Family Drawer** ships its own vaul drawer. We already have one sheet; reuse only its inner view transition, or it will fight snap points.
- **Halo Segmented** adds Base UI next to Radix. Acceptable, but shadcn `toggle-group` plus a `motion` layout thumb is the zero dependency fallback.
- manus.im visual details (exact colours, type, motion) could not be read from fetched text; only structure and tone were.
- Building palette contrast against risk hex overlays at night has not been viewed in a render.
- Deps the supervisor would need to add: `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`, plus the "Brings in" column for whichever slots are adopted.
