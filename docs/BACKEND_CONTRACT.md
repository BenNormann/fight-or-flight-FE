# Backend contract

**Status: read from backend source on 2026-11-14.** Repo `RithvikR1218/fight-or-flight-BE`, branch `backend-setup` (HEAD `f8d2f98`, not merged; `main` has only a README). Shapes come from handler code, not from a running server: nothing was executed, and the backend declares no response schemas. Re-sync when that branch merges or changes.

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

## FE status

- No adapter matches this API yet. The existing `config` adapter, fixture and mock handler follow the FE's earlier proposal (`/api/config`) and are obsolete; they stay only so the app boots in mock mode.
- The dev proxy forwards `/api`, which already covers `/api/v1`.

## History

- 2026-11-14 (a): FE proposal replaced by the endpoint list supplied by the product owner.
- 2026-11-14 (b): synced from backend source (`backend-setup`): added the `/api/v1` prefix, response shapes, `/buildings`, `/roads`, `/roads/graph`, `/observations/metrics`, `/incidents/hourly`, PMTiles layer details, and planned endpoints from `algorithm-init`.
