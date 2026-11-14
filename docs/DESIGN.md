# Fight or Flight — Design

A detailed campus map (plus ~10 miles around), modelled on Google Maps and Waze. Safety is one feature inside it, one tap away, never the identity. Tokens: `src/styles/tokens.css`. Design at 390×844, check 360×780, 768 and 1440×900, night theme first.

## 1. Visual rules

- **Colour.** Chrome is monochrome (`#181818` / `#1F1F1F` / `#272727` / `#313131` at night). Hue is data: five risk bands (`src/lib/risk.ts`, always with a label) and the selection ring. One accent, `brand` (green, 6.3:1 light, 9.9:1 night), for primary map actions only: Directions and Start. `destructive` only for emergency calls. Flat backgrounds; no gradients except the map's horizon fog.
- **Type.** Geist only; Geist Mono for numbers (ETA, distance, capacity). Text uses the named styles in tokens.css: `heading-4..6`, `title-2..4`, `body-3/5/6`, `button-md/sm`, `caption-3..5`. No loose size + weight pairs. 16px inputs. Sentence case, no hyphens in copy, calm system messages.
- **Spacing.** 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96 px. Named: `tap` 44, `fab` 56, `gutter` 16, `sheet-peek` 96, panel 400.
- **Radius.** Tailwind steps. Chips, pills, round buttons `full`; controls `xl`; cards `2xl`; sheet `3xl`; inner = outer − gap.
- **States.** Every control: hover background shift, press `scale(0.98)`, visible focus ring, ≥ 44px target. Loading is a static skeleton shaped like the view. Empty states are composed (icon, line, action). No dead taps: anything without a backend shows a toast saying so.
- **Icons.** lucide-react today. The visual reference prefers Phosphor (`@phosphor-icons/react`); swapping needs a supervisor dep change.

## 2. Layout

| Width | Map chrome | Content surface |
|---|---|---|
| < 768 | Search pill, scrollable category chips (Buildings, Food, Study, Parking, Events, Safety), right stack (layers, locate, safety shield), brand Directions FAB above the sheet, active route pill under the chips | Bottom sheet (vaul, lazy): peek / half / full from `store.sheetSnap` |
| 768–1023 | Same; search pill 400 wide, FAB bottom right | Sheet floats on the left, 400 wide |
| ≥ 1024 | Chips over the map beside the panel; controls bottom right; route pill under the chips | Collapsible left side panel (search on top), slides with transform |

Views are one per feature folder, chosen by `store.view` and rendered by `app/ViewHost` in the sheet or panel: explore, search, place (building, room, POI), directions, events, layers, safety. Routes `/b/:id`, `/r/:id`, `/route?to=` set the store; the store writes the URL back.

## 3. Components

| Slot | Component | Notes |
|---|---|---|
| Sheet | shadcn Drawer (vaul) → `ui/BottomSheet` | Non-modal, lazy loaded |
| Search | Cult Halo Search → `ui/SearchBar` | Shader, hue rim and typing state removed |
| Segmented (map mode, travel mode, theme, floors) | Cult Halo Segmented → `ui/SegmentedControl` | Hue rim removed; thumb is a shared layout element |
| Toast | Cult Halo Toast → `ui/toast`, `ui/notify` | Flat card; Sonner's own motion |
| Route pill | Ours, `ui/StatusPill` | Cult Dynamic Island rejected: animates width/height, hard-coded black, `any` props |
| Chips, rows, action bar, switches, cards | Ours, `ui/primitives` | Built on shadcn `button` |
| Desktop panel | Ours, `ui/SidePanel` | |

## 4. Motion

`motion` only; transform and opacity only. Base curve `ease-settle` `cubic-bezier(0.22,1,0.36,1)`: 200ms colour and fades, 300ms small transforms, 500ms panels. One showpiece per state: camera tilt between 2D / Iso / 3D (800ms) on the map, the route line drawing once in directions, the route pill expanding while navigating. View swaps are a 200ms fade. No loops, no pulsing. Reduced motion: movement becomes opacity, camera jumps.

## 5. Open

- The map is a placeholder (SVG plane with CSS 3D). `src/demo/` is temporary sample data and is deleted when the contract lands.
- Initial JS is ~235 KB gz, over the 200 KB budget; motion, Base UI and react-query are the bulk. LazyMotion or `m` components are the next cut.
