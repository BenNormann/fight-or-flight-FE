# Backend contract

**Status: PROPOSED by the frontend. Nothing has been checked against a real backend.**
Last checked: 2026-11-14 (no backend repo or API URL known yet).

This file records what the backend actually serves. Until a backend exists it holds our proposal, to share with the backend team. It is a starting point, not a requirement: the frontend adapters (`src/api/adapters`) absorb differences, so the backend team should serve what is natural for them and tell us.

## Conventions (proposed)

- JSON, gzip. All paths under `/api`.
- Coordinates are `[lng, lat]` (GeoJSON order). Bounding boxes are `[west, south, east, north]`.
- Times are ISO-8601 with offset. Risk scores are 0 (safest) to 1 (riskiest).
- An endpoint that is not implemented should return 404 or 501; the frontend then hides that feature.
- Additive changes only. Renames or removals: tell the frontend first.

## Endpoints (proposed)

| # | Method & path | Returns | FE status |
|---|---|---|---|
| 1 | `GET /api/config` | `{ bounds: {campus, walk, ride: bbox}, center, basemap, features, riskResolutions, dataUpdatedAt }` | adapter + fixture done |
| 2 | `GET /api/buildings` | GeoJSON FeatureCollection of footprints; properties `{id, code, name, floors, heightM, entrances: [{id, lngLat, accessible?}]}` | P1 |
| 3 | `GET /api/buildings/:id/rooms?floor=` | `[{id, name, floor, type, capacity}]` | P1 |
| 4 | `GET /api/search?q=` | `[{kind: building\|room\|poi\|event, id, label, sublabel, lngLat}]` | P1 |
| 5 | `GET /api/pois?types=&bbox=` | GeoJSON FeatureCollection of points; properties `{id, type, name?}`. Types: `blue_light, dps, entrance, bike_rack, seating` | P1 |
| 6 | `GET /api/risk?res=&bbox=&at=` | `[{h3, score, factors: {crime, lighting, crowd, weather}}]` | P1 |
| 7 | `POST /api/route` body `{from, to, at}` | `{routes: [{kind: safest\|fastest, geometry: LineString, durationS, distanceM, risk: {mean, max}, segments: [{geometry, score}], warnings: []}]}` | P1 |
| 8 | `GET /api/events?from=&to=` | `[{id, title, start, end, location, buildingId?, lngLat?, url}]` (USC Engage SC via the backend) | P1 |

### 1. Config details

- `basemap`: any of `{kind: "style", url}`, `{kind: "vector", tiles: [...]}`, `{kind: "raster", tiles: [...]}`, `{kind: "pmtiles", url}`. A bare `styleUrl` or `tileUrl` string is also accepted.
- `features`: which of `buildings, rooms, search, pois, risk, routing, events, models3d` are served, as a list or a `{name: boolean}` map. Anything not listed is hidden in the app.
- `bounds`: `campus` = full detail, `walk` = risk and routing, `ride` = basemap and ride links (about 10 miles). A single bbox is accepted.

## Formats the adapters will accept

| Data | Accepted |
|---|---|
| Route geometry | GeoJSON LineString, encoded polyline, or a list of H3 cells |
| Risk | H3 cell ids, or GeoJSON polygons with a score |
| Buildings | GeoJSON, or plain JSON with coordinates |
| Map tiles | style URL, vector tiles, raster tiles, PMTiles |
| 3D models | none expected; if the backend later serves them, a new adapter feeds the existing manifest shape |

## Actually served

Nothing yet.

## Gaps and open questions for the backend team

1. Backend repo URL and/or a live API URL (and an OpenAPI spec path, if any).
2. Will the backend serve map tiles, and in which format?
3. Is risk served per H3 cell, and at which resolutions?
4. Can sample responses be committed per endpoint so mock fixtures are rebuilt from real data?
