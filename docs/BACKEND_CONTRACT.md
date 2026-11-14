# Backend contract

**Status: endpoint list supplied by the product owner on 2026-11-14. Paths and purposes only.**
Response shapes, base URL, auth and parameter formats are NOT known yet. Nothing here has been checked against a running backend. Do not write adapters from guesses: wait for sample responses.

The backend is a data-ingestion and ML-feature API over H3 cells. It is not (yet) a map-app API.

## Served (as described by the backend team)

| Method | Path | Purpose | FE use |
|---|---|---|---|
| GET | `/health` | DB status, last successful run per ingestor | Reachability check; data freshness label |
| GET | `/cells?bbox=` | H3 cells with static features | Cell grid for map layers |
| GET | `/observations?cells=&bbox=&metric=&from=&to=&bucket=1m\|10m\|1h` | Time-bucketed observations | History for a tapped cell (chart) |
| GET | `/observations/latest?bbox=&metric=` | Latest value per cell | Live hex layer per metric |
| GET | `/incidents?bbox=&from=&to=&category=` | Crime points | Incident pins / list |
| GET | `/features?bbox=&from=&to=&bucket=10m` | ML feature matrix per (h3_cell, bucket); JSON, or `?format=csv\|parquet` | None. Training data, not for the app |
| GET | `/buildings.pmtiles` | 3D building tiles (static, range requests) | Building footprints / extrusions via the `pmtiles` protocol |
| GET | `/sources` | Ingestion sources, intervals, last run times | Optional "data sources" info |
| POST | `/admin/ingest/{source}` | Manually trigger an ingestor | **Never called by the FE** |

Notes:
- Paths have no `/api` prefix. The dev proxy and `apiFetch` paths must change once the base URL is known.
- There is no config endpoint. Bounds, centre and basemap must come from FE env/defaults; capabilities must be inferred (for example from `/health` or `/sources`).

## Not served (gaps against v1 product scope)

| Product feature | Needs | Status |
|---|---|---|
| Risk heatmap with "why" breakdown | A risk score (0 to 1) per cell with factors | **Gap.** Only raw observations and ML features are served. The FE must not compute risk. Could show a raw metric per cell instead |
| Safe routing (safest vs fastest) | A route endpoint | **Gap.** Blocks the directions feature |
| Search | A search endpoint or a searchable building list | **Gap** |
| Building details, floors, rooms | Building attributes and room lists as JSON | **Gap.** Buildings exist only as tiles; attributes inside the tiles are unknown |
| POIs (blue lights, DPS, entrances, bike racks, seating) | A POI endpoint | **Gap** (some may be static features of `/cells`) |
| Events | An events endpoint | **Gap** |
| Basemap | Streets/labels tiles | **Gap.** Only building tiles are served; the FE needs its own basemap source |

## Open questions for the backend team

1. Base URL (dev and prod), and is there auth or CORS setup?
2. One sample response per endpoint (`/cells`, `/observations/latest`, `/incidents`, `/health`, `/sources`).
3. `bbox` format (`west,south,east,north`?), time format, and the H3 resolution(s) of cells.
4. The list of `metric` names and incident `category` values.
5. `buildings.pmtiles`: layer name(s), zoom range, and attributes per building (id, name, code, height, floors?).
6. Is a served risk score planned (model inference output per cell), and a routing endpoint? If not, who owns them?
7. Are rooms, POIs, events and search planned in this API, or should they come from elsewhere?
8. Is there an OpenAPI spec (FastAPI-style `/openapi.json`)?

## Formats the adapters will accept (when shapes are known)

| Data | Accepted |
|---|---|
| Cells / per-cell values | H3 cell ids with values, or GeoJSON polygons |
| Incidents | GeoJSON points, or JSON with lat/lng |
| Buildings | PMTiles vector layer (served), GeoJSON, or plain JSON |
| Route geometry (if ever served) | GeoJSON LineString, encoded polyline, or H3 cell list |

## History

- 2026-11-14: replaced the FE's original proposal (config, buildings, rooms, search, pois, risk, route, events under `/api`) with the backend's actual endpoint list. The existing `config` adapter, fixture and mock handler follow the old proposal and are now obsolete; they stay only so the app boots in mock mode until real samples arrive.
