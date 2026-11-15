# Odyssey — Frontend Architecture

Mobile-first campus safety map for USC. One map, one bottom sheet, many data layers.
Guiding rule: **every new feature is either a layer, a sheet, or both.** If it doesn't fit, question the feature first.

---

## 0. Repos & backend adaptivity (most important rule)

| Repo | Owns |
|---|---|
| **fight-or-flight-FE** (this repo) | React app, adapters, MSW mocks + fixtures, design tokens, Blender pipeline + GLBs |
| **fight-or-flight-BE** (separate, not visible here) | Flask API: tiles, buildings, rooms, POIs, events, H3 risk scoring, routing |

The backend is unknown and will change. The FE adapts without rewrites:

- **Domain types are ours and stable** (`src/domain`): `Building, Room, Poi, RiskCell, Route, CampusEvent, AppConfig`. All UI and map code depends only on these.
- **Adapters are the only code that knows the backend** (`src/api/adapters`, one per resource): fetch → Zod-validate → convert to domain types. Backend changed? Change the adapter and fixtures, nothing else. Pattern to copy: `adapters/config.ts`.
- **Adapters accept the likely formats.** Routes: GeoJSON lines, encoded polylines, or H3 cell lists. Risk: H3 ids or GeoJSON polygons. Buildings: GeoJSON or plain JSON with coordinates.
- **Basemap is configuration** (`src/map/basemap.ts`): style URL, vector tiles, raster tiles or PMTiles, whichever the backend serves. A free public style is used only in dev/mocks.
- **Capabilities drive the UI** (`src/api/capabilities.ts`): the config endpoint's feature list plus runtime evidence (a 404/405/501 turns a capability off). Unserved features are hidden, never broken. Layers declare `requires`.
- **Mocks mirror reality.** Mock mode is the default when `VITE_API_URL` is unset. Fixtures are raw backend shapes and pass through the adapters. Once real responses exist, fixtures are rebuilt from real samples.
- **`docs/BACKEND_CONTRACT.md`** records what the backend actually serves (until it exists: our proposal). Sync at each phase start and on "backend updated": one read-only agent updates the doc, then one worker updates adapters and fixtures.
- **Env:** `VITE_API_URL`, `VITE_MAP_STYLE_URL` (basemap override), `VITE_USE_MOCKS`. See `.env.example`.
- **Local dev:** Vite proxies `/api` to `VITE_API_URL` (default `http://localhost:5000`), so there is no CORS in dev.
- **Agents in this repo never edit BE code.** A needed contract change goes in the worker report for a human to raise.

---

## 1. Product scope (fleshed out)

| Area | v1 (ship) | Later | Notes |
|---|---|---|---|
| **Map views** | 2D, Isometric, 3D as *camera presets on one map* | Indoor floor plans | No separate isometric renderer. Iso = pitch ~55°, fixed bearing, extruded buildings. 3D = same + Blender GLB buildings. |
| **Buildings / rooms** | Building footprints, floors, room list per floor, room search | Indoor routing, room availability heatmap | Source: USC ArcGIS + roomfinder, ingested by BE. FE never calls ArcGIS directly. |
| **POIs** | Blue-light emergency poles, DPS, building entrances, bike racks, outdoor seating | Water fountains, restrooms, microwaves | All POIs are one generic layer keyed by `type`. Bike racks/seating come from BE satellite extraction; FE doesn't care how. |
| **Safe routing** | Safest vs fastest alternatives with "+N min for safer" delta, leave-at time slider, per-segment risk coloring | Live re-route, walk-with-friend share | Computed on BE over H3 cells. FE only renders. |
| **Risk layer** | H3 hex heatmap (crime, light, crowd, weather blended into one score) with "why" breakdown on tap | User-reported incidents | FE never computes risk. One color scale in `lib/risk.ts` used everywhere. |
| **Events** | Today/this week list + pins (Engage SC via BE feed/ICS) | RSVP | If Engage has no API, BE scrapes/ICS; FE contract is unchanged. |
| **Rides** | "Get a Lyft" deep link to destination; link to USC's free-ride program | In-app ETA | Deep link only, no SDK. |
| **Safety actions** | One-tap call DPS, share live trip link, nearest blue light | Trojans Alert feed | Always reachable in ≤1 tap from any screen. |

### Range — recommendation
10 miles from campus center is ~314 sq mi. That's fine for **tiles and Lyft**, wasteful for everything else.
- **Tier A (full detail)**: UPC + HSC campuses — 3D buildings, rooms, POIs.
- **Tier B (safe routing + risk)**: ~2–3 mi around UPC (where students actually walk).
- **Tier C (basemap + Lyft)**: up to 10 mi. Outside Tier B, the app says "this is a ride, not a walk" and offers Lyft.

Tiers are bounding boxes in the backend config (`AppConfig.bounds`). No hard-coded radii in FE.

---

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite + React 19 + TypeScript (strict)** | Fast, no SSR needed. Not CRA, not Next. |
| Pkg manager | **pnpm** | |
| Styling | **Tailwind v4 + shadcn/ui** | All three UI registries (Cult, Skiper, Watermelon) are shadcn-registry based. |
| Motion | **motion** (framer-motion successor) — the only animation lib | Required by Cult/Skiper components anyway. |
| Bottom sheet | **shadcn Drawer (vaul)** with snap points `[peek, half, full]` | The core mobile primitive. Everything lives in it. |
| Map | **MapLibre GL JS** + **deck.gl** (`MapboxOverlay`, interleaved) | MapLibre: free vector basemap, pitch/extrusions. deck.gl: `H3HexagonLayer`, `PathLayer`, `ScenegraphLayer` (GLBs). |
| Basemap tiles | **Configurable** via `src/map/basemap.ts` (style URL / vector / raster / PMTiles) | The backend decides what it serves; nothing hard-coded. |
| H3 | **h3-js** (render only: cell→boundary, zoom→res) | Routing/scoring is BE. |
| Server state | **TanStack Query** | Caching, retries, background refresh. |
| UI state | **Zustand** (one tiny store) + URL params for anything shareable | No Redux, no Context soup. |
| Routing | **React Router** (4 routes, see §4) | |
| API boundary | **Zod** schemas inside adapters | Validates whatever the backend sends, then converts to domain types. |
| Mocks | **MSW** | FE always runs alone; fixtures follow `docs/BACKEND_CONTRACT.md`. |
| PWA | **vite-plugin-pwa** | Installable, offline campus tiles + GLBs. |
| Tests | **Vitest** + **Playwright** (iPhone 14 + Pixel 7 profiles) | |
| 3D assets | **Blender (via Blender MCP)** → glTF → `gltf-transform` (Draco/Meshopt) | See §7. |

Backend (separate repo): Python + Flask. FE talks only to `/api/*`.

---

## 3. Folder structure

```
src/
  domain/       stable types (index.ts). The only shapes UI and map code may use
  app/          App.tsx, router.tsx, providers.tsx, Shell.tsx
  api/
    client.ts         fetch wrapper + ApiError (returns unvalidated JSON)
    adapters/         one per resource: fetch → Zod → domain. ONLY place that knows backend shapes
    queries.ts        all TanStack Query hooks + query keys
    capabilities.ts   what the backend serves; features gate on it
    mocks/            MSW handlers + fixtures (raw backend shapes)
  map/
    MapView.tsx       the ONLY map instance; MapLibre + deck overlay
    basemap.ts        BasemapConfig → MapLibre style
    camera.ts         presets: '2d' | 'iso' | '3d'
    layers/registry.ts   LayerDef[]; adding a layer = one entry
  features/     search/ building/ route/ events/ safety/ — each exports ONE sheet view + hooks
  ui/           our components; vendor/ holds shadcn-CLI files, wrapped once
  lib/          risk.ts, env.ts, cn.ts, then h3 / geo / deeplinks / time helpers
  state/store.ts   mapMode, selection, sheetSnap, leaveAt, layerOverrides
  styles/       index.css, tokens.css (supervisor-owned)
public/models/  manifest.json, *.glb
tools/blender/  asset scripts
e2e/            Playwright (iPhone 14 + Pixel 7)
```

Import boundaries are enforced by ESLint (`eslint.config.js`).

### Reuse rules
1. **Layer registry.** Every map layer is one `LayerDef` in `src/map/layers/registry.ts` (data hook, `build` factory, legend, `onPick`, `requires` capability). Layer toggles, legend and tap → sheet all derive from the registry. No layer-specific UI code.
2. **Selection drives the sheet.** `store.selection` is a `Selection` from `src/domain`. The sheet renders the matching feature sheet. Deep link `/b/:id` just sets selection.
3. **One risk scale.** `lib/risk.ts` exports `riskColor(score)`, `riskLabel(score)`, `riskBands`. Hexes, route segments, legend, and chips all use it. Never color by risk alone — pair with label/icon (a11y).
4. **Vendor isolation.** Third-party components live in `ui/vendor/`, wrapped once in `ui/`. Swapping a library = editing one file.

---

## 4. Screens (all one shell)

```
┌───────────────────────┐
│ [Search…........][👤] │  ← floating SearchBar (top, safe-area aware)
│                       │
│        MAP            │  ← MapView (full bleed)
│                  [2D] │  ← camera mode segmented control
│                  [◎ ] │  ← locate-me FAB
│ [🆘]                  │  ← Safety FAB, always visible, bottom-left thumb zone
├───────────────────────┤
│ ▔▔  Bottom sheet      │  ← peek / half / full
└───────────────────────┘
```

Routes: `/` · `/b/:buildingId` (building → floors → rooms) · `/r/:roomId` · `/route?from=&to=&at=`.
Everything else (events, layers, settings) is a sheet state, not a route.

**Mobile rules**: 44px min tap targets; primary actions in bottom 40% of screen; `env(safe-area-inset-*)` everywhere; `100dvh` not `100vh`; no hover-only affordances; `prefers-reduced-motion` respected; auto dark theme after sunset (safety context — night is the main use case); haptics via `navigator.vibrate` where supported.

**Perf budget** (mid-range Android, 4G): initial JS ≤ 200 KB gz excluding MapLibre; LCP ≤ 2.5s; deck.gl and 3D layers lazy-loaded on first `iso`/`3d` switch; GLBs ≤ 150 KB each; 60fps pan in 2D.

---

## 5. API contract

Lives in `docs/BACKEND_CONTRACT.md` (our proposal until the backend exists, then what it actually serves). Do not restate it elsewhere.

Zoom → H3 resolution for the heat layer comes from `AppConfig.riskResolutions`. Query keys use rounded bbox + resolution + `at` rounded to 15 min for cache hits.

---

## 6. External links

- **Lyft**: `lib/deeplinks.ts` → `https://lyft.com/ride?id=lyft&destination[latitude]=..&destination[longitude]=..` (universal link; opens app if installed). Shown on any destination and auto-promoted outside Tier B or when route `risk.max` is high.
- **USC events**: open event `url` in new tab; no auth in v1.
- **DPS**: `tel:` link; number in `lib/constants.ts` (verify with USC DPS before launch).

---

## 7. 3D asset pipeline (Blender MCP)

Goal: stylized low-poly campus buildings that look good at iso pitch on a phone, with a graceful fallback.

1. **Source**: building footprints + heights from `/api/buildings` (or the same GeoJSON fixture).
2. **Generate** (Blender MCP, `tools/blender/`): a Python script extrudes each footprint in local meters around a fixed campus origin, applies a shared material palette (≤ 6 materials, matching Tailwind tokens), bevels roofs, and adds hand-detailed hero models for ~10 landmark buildings. Requires Blender running with the MCP add-on.
3. **Export**: one `.glb` per building, origin at footprint centroid, +Y up, meters.
4. **Optimize**: `gltf-transform optimize --compress meshopt --texture-compress webp` → ≤ 150 KB each.
5. **Manifest**: `public/models/manifest.json` = `[{buildingId, glb, lngLat, rotationDeg, heightM}]`.
6. **Render**: `buildings3d.ts` uses deck `ScenegraphLayer` from the manifest. **LOD0 fallback** is MapLibre `fill-extrusion` from footprints — always loaded, so 3D mode works before GLBs arrive and on weak devices.

---

## 8. Design system

- **`docs/DESIGN.md` is the design source of truth** (token rationale, slot → component table, motion rules). Read it, not the websites.
- Tokens first (`src/styles/tokens.css`, Tailwind v4 `@theme`): color (incl. 5 risk bands), type scale, radius, spacing, shadow, motion durations. Light + dark.
- **Design skills / libraries — how to use each**:
  - `elayadesign/ai-design-skills` → only `landing-page-design` and `figma-designer` exist. Use **landing-page-design's visual-system step** to produce tokens (type, spacing, radius, motion). Use **figma-designer** only if mocking in Figma (Figma MCP is available). Install: `npx skills add elayadesign/ai-design-skills -a claude-code`.
  - **Cult UI** (`pnpm dlx shadcn@latest add @cult-ui/<name>`): Halo Search (search bar), Family Drawer (multi-step sheet content), Dynamic Island (active-route status pill), Halo Toast, Direction Aware Tabs / Halo Segmented (camera mode, layer toggles).
  - **Skiper UI** (`npx shadcn add @skiper-ui/<id>`): free single-file components for micro-interactions only; most are paid and Next-oriented — check before adopting.
  - **Watermelon UI** (shadcn registry): browse for animated blocks; install details unverified — confirm via its install page.
  - **manus.im** is an AI agent product, not a component library — visual inspiration only.
- Max one "hero" animation per screen. Map is the star; chrome stays quiet.

---

## 9. Build phases

| Phase | Output | Exit criteria |
|---|---|---|
| **P0 Scaffold** | Vite/TS/Tailwind/shadcn/MSW/PWA/test setup, all known deps installed, tokens, DESIGN.md, folder skeleton, domain types, registry type, CLAUDE.md, BACKEND_CONTRACT.md, `/api` dev proxy, env vars, mock mode | `pnpm check` green; blank shell renders at 390×844 |
| **P1 Foundations** (parallel) | A: MapView + camera presets + layer registry · B: UI shell (SearchBar, Sheet w/ snaps, FABs, theme) · C: adapters + capabilities + queries + MSW fixtures + store · D: Blender pipeline + 3 sample GLBs | Each lane's own tests + build pass; merged |
| **P2 Features** (parallel) | search/building/rooms · route (safest vs fastest, leave-at) · risk layer + POIs · events + Lyft + safety | Golden-path Playwright tests on mobile profiles |
| **P3 Polish** | Full GLB set, offline, perf budget, a11y audit, dark-night mode | Lighthouse mobile ≥ 90 perf / ≥ 95 a11y |
