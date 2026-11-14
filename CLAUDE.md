# Fight or Flight FE — rules for every agent

Read `docs/ARCHITECTURE.md` sections only as your brief points you to. Don't re-read whole docs.

## Invariants
- Mobile first. Design at 390×844, then check 360×780 and desktop. 44px tap targets, safe-area insets, `100dvh`.
- One map instance (`src/map/MapView.tsx`). New map data = a `LayerDef` in `src/map/layers/registry.ts`. No layer-specific UI.
- Selection (`state/store.ts`) drives the bottom sheet. Features never import other features.
- UI and map code depend only on `src/domain` types. Only `src/api/adapters/` knows backend response shapes (validated with Zod). Backend changed? Change the adapter and fixtures, nothing else.
- Basemap comes from config (`src/map/basemap.ts`), never hard-coded tiles. Features gate on `src/api/capabilities.ts`; hide what the backend doesn't serve.
- What the backend actually serves is in `docs/BACKEND_CONTRACT.md`. Read that, not guesses.
- Risk colors/labels only from `src/lib/risk.ts`. Never color-only signals.
- Third-party UI goes in `src/ui/vendor/` via shadcn CLI and is wrapped once in `src/ui/`. Features import from `src/ui/` only.
- Design decisions (tokens, which component fills which slot, motion) are in `docs/DESIGN.md`. Read that, not the design websites.
- Animation: `motion` only. Respect `prefers-reduced-motion`.
- FE never computes risk or routes. It renders BE output (or MSW mocks).
- The Flask backend is a separate repo you can't see or edit. The contract is `docs/BACKEND_CONTRACT.md`. Need a contract change? Put it in your report; don't work around it in FE.
- The app must always run with `VITE_USE_MOCKS=true` and no backend.
- Only the supervisor edits `package.json`, `vite.config.ts`, `tsconfig*`, `tokens.css`. Need a dep? Say so in your report.

## Commands
- `pnpm dev` · `pnpm check` (typecheck + lint + vitest) · `pnpm build` · `pnpm e2e` (Playwright mobile profiles)

## Done means
`pnpm check && pnpm build` pass, and you viewed your UI in the built-in browser at the mobile preset.

## Reporting (keep it short)
≤150 words: files touched, contract/registry changes, deps needed, open questions. No code, no file dumps.
