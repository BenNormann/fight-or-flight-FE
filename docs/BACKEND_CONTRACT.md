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
- Prefix **`/api/v1`**. CORS: the FE origins in `FRONTEND_ORIGINS`, with credentials (see Auth). No auth for reads.
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
| Safe routing | **Served** (checked live 2026-11-14): see "Routing" below |
| Turn-by-turn steps | **Gap.** Wanted with each route: `{maneuver, at: [lng, lat], offset_m, distance_m, name?}` (maneuver: depart, straight, slight/sharp left/right, left, right, u-turn, arrive). Until then the FE reads left / right off the line's shape (`src/lib/nav/steps.ts`), with no street names |
| Building names, codes, floors, rooms | **Gap.** No campus building identity anywhere in the API |
| Search | **Served, no data loaded yet**: see "Search and places" below |
| POIs (blue lights, DPS, bike racks, seating) | **Gap.** `algorithm-init` references a blue-light CSV that is not in the repo |
| Events | **Gap** |
| Basemap (streets, labels) | **Gap.** FE supplies its own basemap; `/roads` could draw streets but has no labels or land use |
| Config endpoint (bounds, centre) | **Gap.** `/api/config` is 404; the FE falls back to `LIVE_DEFAULT_CONFIG` in `src/api/adapters/config.ts` (USC centre, `auth` and `routing` on) |

## Routing (served)

`GET /api/v1/route?from=lat,lng&to=lat,lng[&at=ISO][&date=&hour=&max_detour=&phone_weight=]`. Public. Walking only.

Response: `{ safe, shortest, date, hour, start, end, snap_m, params, ... }`. Each of `safe` and `shortest`:
`geometry` (GeoJSON LineString, `[lng, lat]`), `coords` (`[lat, lng]`), `length_m`, `detour_pct`, `mean_risk`, `max_risk` (0 to 1),
`high_risk_m`, `no_data_pct`, `n_phones`, `phones_passed[] {name, lat, lon, dist_m}`, `via_phone`.

Errors: `400 {code, message}` when the ends are over 12 km apart, or an end is over 300 m from a walkable street, or there is no path; `503` while the planner warms up. The FE shows the 400 `message` as is.

Adapter: `src/api/adapters/route.ts` (`safe` -> `safest`, `shortest` -> `fastest`). Not in the response, so derived in the adapter:
- **Travel time**: `length_m / 1.35 m/s`. Bike and ride only change the time; the line is the walking line.
- **Per-segment risk**: none, so the whole line is coloured by `mean_risk`. Wanted: risk per stretch of the line.
- **Steps**: see the gaps table.

## Search and places (served; merged in RithvikR1218/fight-or-flight-BE#8)

- `GET /api/v1/search?q=&near=lat,lng&bbox=&category=&open_now=&limit=` -> `{ results: [{ id, kind, name, category, subcategory, address, lat, lng, distance_m?, rating?, review_count?, open_now? }] }`, best match first. `q` or `category` is required (400 otherwise).
- `GET /api/v1/search/categories` -> `[{ id, label, count, types: [{ id, label, count }] }]`. 18 categories plus `other`.
- `GET /api/v1/places/{id}?near=` -> the result fields plus `hours` (`{ monday: [{ open, close, overnight?, all_day? }], ... }`, `[]` = closed, `null` = unknown), `hours_text`, `phone`, `website`, `photo_url`, `description`, `rating_breakdown`, `attributes`, `reviews`, `aliases`.
- `GET /api/v1/geocode/reverse?at=lat,lng` -> `{ name, address, id, kind, distance_m }`; 404 when nothing named is near.

Adapter: `src/api/adapters/places.ts`. **Checked live 2026-11-14: the endpoints answer, but `/search` returns no results and `/search/categories` is `[]`** (the `places` table is not loaded on the hosted backend: `flask db upgrade`, then `python -m scripts.load_places`). Reverse geocoding does answer.
The FE treats an empty category list as "places not loaded" and keeps `src/demo` for search, pins and Explore until it is non-empty; nothing needs redeploying on the FE when the data lands.

## Open questions for the backend team

1. Is `buildings.pmtiles` built on the shared dev backend, and what is the dev base URL?
2. Will campus building identity (name, code, entrances) and rooms come from this API or elsewhere?
3. Timeline and response shapes for `/score`, `/hotzones` and `/route`.
4. Will POIs (blue lights) and events be served?
5. Can response schemas be declared so `/api/openapi.json` documents the bodies?

## Auth (implemented on the backend: PR RithvikR1218/fight-or-flight-BE#4 into `backend-setup`, not merged yet)

Google OpenID Connect, limited to `@usc.edu` Workspace accounts. Reads stay public. Backend docs: its README, section "Auth".

| Method & path | Behaviour |
|---|---|
| `GET /api/v1/auth/login?next=<absolute FE url>` | Full-page redirect to Google (`hd=usc.edu` hint). `next` must be on an origin in the backend's `FRONTEND_ORIGINS`, else it becomes that list's first origin root |
| `GET /api/v1/auth/callback` | Google returns here. Backend verifies the ID token, sets the session cookie and redirects to `next` |
| `GET /api/v1/auth/me` | `200 {id, email, name, picture}` (`id` = Google `sub`, `name`/`picture` may be `null`), `401` when signed out. `Cache-Control: no-store` |
| `POST /api/v1/auth/logout` | `204`, clears the session |
| `GET /api/v1/auth/dev/login?email=&next=` | Only when the backend sets `AUTH_DEV_LOGIN=true` (local testing): signs in any `@usc.edu` address without Google. `404` otherwise. **Never called by the FE** |

- Refused or failed sign-in redirects to the FE's `/login?error=<code>&next=<path>`. Codes: `domain` (not a verified `@usc.edu` Workspace account), `cancelled` (declined at Google), `failed` (state or token error), `unavailable` (backend has no Google client or `SECRET_KEY`).
- Session: cookie `fof_session` (Flask signed cookie), httpOnly, 7 days, `SameSite=Lax` by default. FE on another site: the backend sets `SameSite=None; Secure`.
- CORS on `/api/*` now names `FRONTEND_ORIGINS` (default `http://localhost:5173,http://localhost:4173`) and allows credentials. Any other origin, including a deployed FE, must be added there.
- The backend serves no config endpoint, so the FE probes `/me` to learn whether auth is served (see `useSession`).

### Live location (still PROPOSED, not in the backend)

| Method & path | Behaviour |
|---|---|
| `POST /api/v1/location` (signed in) | Body `{lat, lng, accuracy_m, speed_mps?, ts}` → `204`. No direction: heading stays on the device (owner decision; the algorithm does not use it). `401` when signed out |

The FE posts every 10 seconds while active (may drop to 5), only while signed in and opted in. Still open for the backend team: location retention and who can read it, and which other endpoints will require sign-in.

## FE status

- Wired: auth, `/route` (directions between any two points), `buildings.pmtiles`. Everything else (places, search, heat, events) is still `src/demo`.
- The `config` adapter, fixture and mock handler follow the FE's earlier proposal (`/api/config`); they stay so the app boots in mock mode.
- The dev proxy forwards `/api`, which already covers `/api/v1`.

## History

- 2026-11-14 (a): FE proposal replaced by the endpoint list supplied by the product owner.
- 2026-11-14 (b): synced from backend source (`backend-setup`): added the `/api/v1` prefix, response shapes, `/buildings`, `/roads`, `/roads/graph`, `/observations/metrics`, `/incidents/hourly`, PMTiles layer details, and planned endpoints from `algorithm-init`.
- 2026-11-14 (c): auth implemented on the backend (Google, USC only); contract updated from that code. Live location still proposed.
- 2026-11-14 (d): `/route` is live and wired; search endpoints requested; `/api/config` fallback documented.
- 2026-11-14 (e): search, categories, place detail and reverse geocode wired; hosted `places` table is still empty.
