# Vessels Plugin

Real-time AIS ship positions via [AISStream.io](https://aisstream.io).

## Routes

- `GET /api/vessels/live?bounds=minLon,minLat,maxLon,maxLat` — GeoJSON FeatureCollection of cached vessel positions. `bounds` is optional; without it, returns all cached vessels.
- `GET /api/vessels/status` — connection state, message count, vessel count, last error.

## How it works

A single backend WebSocket connection to `wss://stream.aisstream.io/v0/stream` is opened on server start, subscribed to one or more bounding boxes (default: Arctic only, north of 60°N). Each incoming AIS message updates an in-memory `Map<MMSI, vessel>`. Records older than `AISSTREAM_TTL_MINUTES` (default 60) are evicted by a periodic sweep.

Why backend-only: a direct browser WS connection would expose the API key and produce one upstream connection per visitor. A shared backend cache also lets the REST endpoint be cached and bbox-filtered cheaply.

## Env

| Var | Default | Notes |
|---|---|---|
| `AISSTREAM_API_KEY` | _unset_ | Required. Free at https://aisstream.io. If unset, the route returns an empty FeatureCollection and no upstream connection is opened. |
| `AISSTREAM_BBOX` | `[[[60,-180],[90,180]]]` | JSON array of `[[lat,lon],[lat,lon]]` boxes. AISStream uses **lat,lon** order, not lon,lat. |
| `AISSTREAM_TTL_MINUTES` | `60` | Evict cached vessels with no update in this window. |

## MMGIS layer config

Add a vector layer to the mission `configs` row, pointing at the route, with `time.refreshIntervalEnabled` so it polls:

```json
{
  "name": "Vessels (Live AIS)",
  "uuid": "vessels-aisstream-001",
  "type": "vector",
  "sourceType": "url",
  "url": "/api/vessels/live",
  "visibility": false,
  "initialOpacity": 0.9,
  "style": { "color": "#ffaa00", "fillColor": "#ffaa00", "weight": 1, "radius": 4 },
  "time": {
    "enabled": false,
    "refreshIntervalEnabled": true,
    "refreshIntervalAmount": 30
  },
  "variables": {}
}
```

## Notes

- AISStream is community-fed — Arctic vessel density is modest. Expect tens to low hundreds of vessels in the Arctic bbox.
- Cached records do not include historical tracks. For tracks, persist position reports to PostGIS in a follow-up.
