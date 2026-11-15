# Fight or Flight — Design

A detailed campus map (plus ~10 miles around), modelled on Google Maps and Waze. Safety is one feature inside it, never the identity. Tokens: `src/styles/tokens.css`. Visual law: `.claude/skills/landing-page-design/SKILL.md` Part B. Design at 390×844, check 360×780, 768 and 1440×900, both themes.

## 1. Brand colour

Neutral chrome, two Trojan colours, each with one job. **Cardinal by day, gold by night.**

| Role | Token | Light | Night | Where |
|---|---|---|---|---|
| Action fill | `brand` / `brand-foreground`, `brand-hover`, `brand-pressed` | `#990000`, white 8.9:1 | same; add `shadow-brand` | The one main action per view: Directions FAB, Start, primary button. Never two on screen |
| Glyph on brand | `brand-accent` | gold on cardinal 5.9:1 | same | FAB arrow, route pill badge |
| Selected | `selected` / `selected-foreground` | cardinal, white | gold, `#181818` 11.7:1 | Map selection only: selected pin and ring, segmented over the map. Pressed chips (over the map too), switches, rows and cards are neutral `primary` fill or `accent` row |
| Brand ink | `brand-ink` | cardinal 8.9:1 | gold 11.7:1 (8.6:1 worst case) | Links, active icon, eyebrow, live ETA figure |
| Tints | `brand-subtle`, `gold-subtle` (+ `-foreground`) | `#fbeeee` 7.9:1, `#fff6d1` 6.8:1 | `#131209` 12.4:1 | Selected row, icon tile of the active item, saved and tonight badges |
| Gold fill | `gold` / `gold-foreground`, hover, pressed | dark ink 11.7:1 | same | Small marks only: saved star, "now" dot, the keystone (§2) |

Neutral is everything else: surfaces, text, secondary buttons, unselected chips, borders, focus ring (`ring`).

**Hard limits.** Gold on a light surface is 1.5:1: in light theme gold is only a fill under dark ink, never text, icon or outline. Cardinal on night surfaces is 2.0:1: at night cardinal is only a fill under white or gold, never text, icon or outline.

**Cardinal vs SOS vs risk, resolved three ways.**
1. *Hue.* Risk bands may not sit between 345° and 15°. `risk-4` moved to amber orange, `risk-5` to violet magenta, night `risk-3` to lemon lime (greener, paler than gold). `destructive` is signal red `#d4162b` by day (white 5.3:1) and coral `#ff5a52` with dark ink at night (6.4:1), the opposite polarity to cardinal.
2. *Territory.* Cardinal and gold live on chrome and on the selected pin only. Risk colours live on map data and risk badges only (`src/lib/risk.ts`). `destructive` is SOS, emergency call and inline errors only. No brand colour ever fills a map area; no risk colour ever fills a control.
3. *Form.* SOS is always a pill with a phone icon and a word. Errors always carry an icon and a sentence. Risk always carries its label. Brand actions are a verb. Nothing is identified by colour alone.

## 2. Personality

- **Map palette** (`map-*`). Day is warm sandstone paper with brick toned buildings and white roads; night is the neutral dark stack with slightly warm building edges. Low chroma so risk reads on top. Labels `map-label` with a `map-label-halo`.
- **Pins.** Round, 32px, `card` fill, `shadow-chip`, Phosphor glyph in `foreground`. Emergency phones keep the inverted (`primary`) fill. No brand colour on resting pins.
- **Selected.** Pin grows to 40px (transform), fills `selected`, and its building takes a 2px `selected` ring with a `background` casing. Pressed chips fill `primary`; rows and in-sheet controls stay neutral (§1).
- **Signature: the keystone.** A 4px gold dot sits at the top right of every cardinal fill (FAB, primary button, route pill badge) and marks "you are here" on the map. It is the only decoration in the app.
- **Empty states.** `card` tile, 48px `muted` circle with a duotone Phosphor icon in `foreground`, one Title 3 line, one Body 6 line, one secondary button. Full border or none; never dashed.
- **Voice.** Sentence case, no hyphens in copy, calm and specific messages.

## 3. Components

Type: Geist only, Geist Mono for numerals; named styles only. Spacing: 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 plus `tap` 44, `fab` 56, `gutter` 16. Radius: Tailwind steps, inner = outer − gap. Flat backgrounds. Every control: hover shift, press `scale(0.98)`, focus ring, 44px target.

| Component | Rules |
|---|---|
| **Elevation** | `shadow-raised` cards · `shadow-chip` chips, pins, map labels · `shadow-float` search, round controls · `shadow-brand` cardinal FAB · `shadow-overlay` toast, panel · `shadow-sheet`. Each already includes a 1px casing, so a floating element has **shadow or border, never both**. Shadows only on opaque fills; `bg-glass` takes a border and no shadow. |
| **Chip** | 44px high, `rounded-full`, `px-4`, `gap-2`, 16px icon, Button-sm. Over the map: opaque `card` fill, `shadow-chip`, no border, no blur. In a sheet: `secondary` fill, no shadow. Pressed: `primary` fill, no shadow, `aria-pressed`. |
| **Chip row** | Scroller = `flex gap-2 overflow-x-auto mask-fade-x`, scrollbar hidden, `scroll-padding-inline: 16px`. Bleeds to both screen edges (`-mx-gutter px-gutter`). Block padding 8px with `-my-2`, so `shadow-chip` (max 8px) is never clipped. The mask fades 16px at the start (equal to the gutter, so the first chip rests clear) and 32px at the end; the last visible chip must be cut by the edge, never end flush. Nothing else may clip or shadow the row. |
| **Switch row** | Row `flex items-center gap-3 min-h-14`, whole row is the target. Track 40×24, `rounded-full`, **no border** (inset 1px ring in `input` when off), `shrink-0`, `self-center`. Thumb 16px, placed `top-1/2 left-1 -translate-y-1/2`, travels 16px by transform. With a description the track still centres on the whole text block. Off: `muted` track, `input` thumb. On: `primary` track, `primary-foreground` thumb. Label Title 3, description Body 6, no margins on either. |
| **Buttons** | Primary: `brand`, Button-md, `rounded-xl`, min height 44, padding 8 / 12 (16 inline when full width), hover `brand-hover`, press `brand-pressed`. Secondary: `secondary` fill, full `border`. Ghost: no fill, hover `accent`. Destructive: SOS only. One primary per view. |
| **Cards** | `card` fill, `rounded-2xl`, padding 16, `shadow-raised` **or** full `border`. Never a single side border. Inner media `rounded-lg` (16 − 8). |
| **List rows** | `min-h-14`, `gap-3`, `rounded-xl`, hover `accent`. 40px icon tile `rounded-lg` `muted`; selected row: `accent` fill and `primary` tile. Title 3, Body 6 muted, Caption 4 meta in Geist Mono when numeric, 16px caret. |
| **FABs** | Directions: 56px, `rounded-2xl`, `brand` fill, gold glyph, `shadow-brand`, keystone. Map controls: 44px circles, `card` fill, `shadow-float`, grouped with 8px gaps; active control glyph in `brand-ink`. All respect safe areas and sit 16px from edges. |
| **Sheet / panel header** | 4×32 `muted-foreground` grabber, 8px above the header. Back button, eyebrow Caption 4 in `brand-ink`, title Heading 6, subtitle Body 6 muted, close at right. Padding 16, bottom gap 16. No divider line; content scrolls under a flat `card` header. |
| **Icons** | Phosphor only (`@phosphor-icons/react`, installed): Regular at rest, Fill when selected, Duotone in empty states. 16px in chips and buttons, 20px in tiles and controls, 24px in the FAB. Migrate off lucide. |

Layout (unchanged): under 768 a bottom sheet with search pill, chip row and right control stack; 768 to 1023 a floating 400px sheet; from 1024 a collapsible left panel with chips over the map. Views are one per feature folder, rendered by `app/ViewHost`.

## 4. Motion

`motion` only; transform and opacity only. Curve `ease-settle` `cubic-bezier(0.22,1,0.36,1)`: 200ms colour and fades, 300ms small transforms (switch thumb, pin growth, chip press), 500ms sheets and panels. Showpieces: camera tilt between 2D / Iso / 3D (800ms), the route line drawing once, the route pill expanding, the keystone settling onto a newly selected pin (`ease-emphasis`). No loops, no pulsing. Reduced motion: movement becomes opacity, camera jumps.

## 5. Open

- Components still use `primary` for pressed chips and switches, `border` + `shadow-float` + glass on chips, and lucide icons; the rules above need a UI lane pass.
- The placeholder map ignores `map-*`; the real basemap style should read them.
