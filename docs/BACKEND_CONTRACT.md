# Backend contract

**Status: read from backend source on 2026-11-14, then checked against the hosted backend the same day (see "Hosted backend").** Repo `RithvikR1218/fight-or-flight-BE`, branch `backend-setup` (HEAD `f8d2f98`, not merged; `main` has only a README). Shapes come from handler code, not from a running server: nothing was executed, and the backend declares no response schemas. Re-sync when that branch merges or changes.

## Hosted backend (checked live 2026-11-14, read-only requests)

Base URL: `https://trojan-odyssey.northcentralus.cloudapp.azure.com` (API title "USC Safe-Route Data API", v1). Set it locally as `VITE_API_URL` in `.env.local`; never commit it into code.

| Area | Live result |
|---|---|
| `/health`, `/sources`, `/observations/metrics` | 200. Ingestors `lapd`, `lapd_nibrs`, `nws`, `openmeteo`, `sun` ok; `la311` skipped |
| `/incidents?bbox`, `/incidents/hourly` | 200 with data. Incident shape as documented below; `severity` can be `null` |
| `/buildings.pmtiles` | **Built.** 206 on range requests, 101 MB, `Accept-Ranges: bytes`, CORS `*` |
| `/cells`, `/roads`, `/buildings`, `/observations/latest` (campus bbox) | 200 but **empty**: static tables look unloaded on the host |
| `/pois`, `/pois/types` (NEW) | 200 but empty. GeoJSON FeatureCollection; params `bbox, type, cells, limit`; extra attributes (e.g. `table_count_est`) merged into feature properties |
| `/risk/status` (NEW) | 200 `{available: false, reason: "missing crime.db…"}` |
| `/risk/score`, `/risk/hotzones`, `/risk/edges` (NEW) | **503** until the model is loaded. `score`: risk + SHAP factors for a point (`lat,lng`) or `cell`, at `at` / `date`+`hour`. `hotzones`: risk per modelled cell for one hour plus `no_data_cells`. `edges`: risk-weighted cost per walk-graph edge (join to `/roads/graph` on `u,v,key`) |
| `/auth/*`, `/location` | **404.** Not deployed |
| Routing | Still no route endpoint. `/risk/edges` + `/roads/graph` are routing inputs, not routes |
| CORS | `/api/*` echoes the request origin (`Vary: Origin`); no `Access-Control-Allow-Credentials` seen, which cookie sign-in will need |

FE consequences: `/risk/status` is the capability probe for risk (treat 503 as "not served"). Response bodies for the risk endpoints are unverified until the model is loaded.

## Setup

- Flask 3 + flask-smorest, PostgreSQL/PostGIS/TimescaleDB. Local: `docker compose` → API on port **5000**.
- Prefix **`/api/v1`**. CORS: any origin on `/api/*`. No auth for reads.
- OpenAPI at `/api/openapi.json`, Swagger UI at `/api/docs` (parameters documented, response bodies not).
- `bbox` = `minLng,minLat,maxLng,maxLat`. Times ISO-8601, UTC by default.
- H3 resolution 9 for crime, streetlights, buildings, features (6,909 cells); resolution 6 for sun and weather (30 cells).

## Endpoints (all under `/api/v1`, all implemented)

| Method & path | Response (per item) | FE use |
|---|---|---|
| `GET /health` | `{status, db, ingestors: [{source, status, started_at, finished_at, rows, error}]}` | Reachability, data freshness |
| `GET /cells?bbox&format=json\|geojson` | `{cell, parent_r6, building_count, avg_height_m, streetlight_count, road_length_m, lit_road_length_m, intersection_count}` | Hex grid; lighting layer (lit road share, streetlights) |
| `GET /observations?cells&bbox&metric&source&from&to&bucket=raw\|1m\|10m\|1h` | raw: `{t, h3_cell, source, metric, value}`; bucketed adds `avg/min/max/n` (`last` for 10m, 1h). Default window 1h, bucket 10m | Cell history |
| `GET /observations/latest?bbox&metric` | latest value per cell (last 24h) | Live per-metric layer |
| `GET /observations/metrics` | metrics seen in the last 7d | Layer list |
| `GET /incidents?bbox&cells&category&severity=1\|2&from&to` | `{source, external_id, ts, lat, lng, h3_cell, category, crime_code, severity}`; default 30d | Incident pins and list |
| `GET /incidents/hourly` | `{bucket, h3_cell, n}` (ignores bbox and severity) | Incident counts per cell |
| `GET /features?bbox\|cells&from&to&format=json\|csv\|parquet` | ML feature rows per `(h3_cell, bucket)` | None (training data) |
| `GET /buildings.pmtiles` | PMTiles, **404 until built**. Layer `buildings`, zoom 10 to 16, only attribute **`height_m`** (4 m default) | Extruded buildings via MapLibre + `pmtiles` |
| `GET /buildings?bbox` (bbox required) | GeoJSON; props `height_m, elev_m, h3_cell` | Building detail / fallback footprints |
| `GET /roads?bbox` (bbox required) | GeoJSON; props `u, v, key, name, highway, lit, sidewalk, length_m, h3_cell` | Lit / unlit streets layer |
| `GET /roads/graph?part=edges\|nodes&format=parquet\|csv\|json` | road graph; JSON capped at 100,000 rows | None (routing input) |
| `GET /sources` | `[{name, description, enabled, interval_minutes, last_run}]` | Data sources info |
| `POST /admin/ingest/{source}` | ingest run status | **Never called by the FE** |

Metrics: `sun_altitude_deg`, `is_dark`, `temp_c`, `humidity_pct`, `precip_mm`, `cloud_cover_pct`, `wind_speed_kmh`, `visibility_m`, `streetlight_outages_open` (off unless configured). Incident `category` is free text from LAPD data, not an enum.

Buildings: 969,395 LA County footprints (LARIAC 2020) within ~16 km (10 miles) of campus. **No names, codes or ids**: buildings are anonymous shapes with a height.

## Not served (gaps against v1 product scope)

| Product feature | Status |
|---|---|
| Risk score per cell with factors | **Gap.** Branch `algorithm-init` has an XGBoost crime-risk model and plans `GET /hotzones?hour`, `GET /score?lat&lng&hour`; not implemented. FE must not compute risk |
| Safe routing | **Gap.** `GET /route` is planned in `algorithm-init`, not implemented |
| Turn-by-turn steps | **Gap.** The FE's turn banner needs steps with each route: `{maneuver, at: [lng, lat], offset_m, distance_m, name?}` (maneuver: depart, straight, slight/sharp left/right, left, right, u-turn, arrive). The FE renders steps; it does not derive them from geometry in production |
| Building names, codes, floors, rooms | **Gap.** No campus building identity anywhere in the API |
| Search | **Gap** (nothing to search without named places) |
| POIs (blue lights, DPS, bike racks, seating) | **Gap.** `algorithm-init` references a blue-light CSV that is not in the repo |
| Events | **Gap** |
| Basemap (streets, labels) | **Gap.** FE supplies its own basemap; `/roads` could draw streets but has no labels or land use |
| Config endpoint (bounds, centre) | **Gap.** FE uses env/defaults |

## Open questions for the backend team

1. Is `buildings.pmtiles` built on the shared dev backend, and what is the dev base URL?
2. Will campus building identity (name, code, entrances) and rooms come from this API or elsewhere?
3. Timeline and response shapes for `/score`, `/hotzones` and `/route`.
4. Will POIs (blue lights) and events be served?
5. Can response schemas be declared so `/api/openapi.json` documents the bodies?

## Auth and live location (PROPOSED by the FE on 2026-11-14, not in the backend yet)

The backend has no auth today. The FE is built against this proposal behind one adapter each (`src/api/adapters/auth.ts`, `location.ts`), so the paths and shapes can change in one place. Mock mode simulates all of it.

| Method & path | Behaviour |
|---|---|
| `GET /api/v1/auth/login?next=<url>` | Full-page redirect to the OAuth provider. The FE navigates the browser here; it never sees provider credentials |
| `GET /api/v1/auth/callback` | Provider returns here. Backend creates the session (httpOnly cookie) and redirects to `next` |
| `GET /api/v1/auth/me` | `200 {id, email, name?, picture?}` when signed in, `401` otherwise |
| `POST /api/v1/auth/logout` | `204`, clears the session |
| `POST /api/v1/location` (signed in) | Body `{lat, lng, accuracy_m, speed_mps?, ts}` → `204`. No direction: heading stays on the device (owner decision; the algorithm does not use it). `401` when signed out |

Decided by the product owner (2026-11-14):
- Sign-in is limited to `@usc.edu` accounts. The backend must enforce this; on rejection it should redirect to the FE's `/login?error=domain`.
- The session is an httpOnly cookie. So CORS must name the FE origin and allow credentials (today it is `*`, which browsers reject with credentials), and with the FE on another origin the cookie needs `SameSite=None; Secure`.
- The FE posts location every 10 seconds while active (may drop to 5), only while signed in and opted in.

Still open for the backend team:
1. Which OAuth provider (Google with a hosted-domain restriction? USC SSO?).
2. `next` must be validated against an allow-list (open-redirect risk).
3. Location retention, and who can read it.
4. Which endpoints will require sign-in (routing only, or more)?

## FE status

- No adapter matches this API yet. The existing `config` adapter, fixture and mock handler follow the FE's earlier proposal (`/api/config`) and are obsolete; they stay only so the app boots in mock mode.
- The dev proxy forwards `/api`, which already covers `/api/v1`.

## History

- 2026-11-14 (a): FE proposal replaced by the endpoint list supplied by the product owner.
- 2026-11-14 (b): synced from backend source (`backend-setup`): added the `/api/v1` prefix, response shapes, `/buildings`, `/roads`, `/roads/graph`, `/observations/metrics`, `/incidents/hourly`, PMTiles layer details, and planned endpoints from `algorithm-init`.
