# Aircraft and Vessels Tracking Layers Setup

## Summary

This document outlines the changes made to enable Aircraft (ADS-B) and Vessels (AIS) tracking layers in MMGIS.

## Changes Made

### 1. Plugin Migration

The Aircraft and Vessels backend plugins have been moved from `API/MMGIS-Plugin-Backend/` to `plugins/core/backend/` to integrate with MMGIS's plugin discovery system.

**Files moved:**
- `API/MMGIS-Plugin-Backend/Aircraft/` → `plugins/core/backend/Aircraft/`
- `API/MMGIS-Plugin-Backend/Vessels/` → `plugins/core/backend/Vessels/`

**Changes in each plugin directory:**
- Renamed `setup.js` to `plugin.js` (required by plugin system)
- Created `plugin.json` manifest file

### 2. Plugin Manifests Created

**`plugins/core/backend/Aircraft/plugin.json`:**
```json
{
  "name": "Aircraft",
  "version": "1.0.0",
  "description": "Real-time ADS-B aircraft tracking via OpenSky Network API",
  "author": "MMGIS Team",
  "engines": {
    "mmgis": ">=4.0.0"
  },
  "priority": 100,
  "overridable": true,
  "dependencies": []
}
```

**`plugins/core/backend/Vessels/plugin.json`:**
```json
{
  "name": "Vessels",
  "version": "1.0.0",
  "description": "Real-time AIS vessel tracking via AISStream.io",
  "author": "MMGIS Team",
  "engines": {
    "mmgis": ">=4.0.0"
  },
  "priority": 101,
  "overridable": true,
  "dependencies": []
}
```

## Required Configuration

### Environment Variables

Add the following to your `.env` file:

#### Aircraft Tracking (OpenSky Network)

```bash
# Enable aircraft tracking
WITH_AIRCRAFT=true

# Optional: customize bounding box (defaults to Arctic Circle)
OPENSKY_BBOX_LAMIN=66.5
OPENSKY_BBOX_LOMIN=-180
OPENSKY_BBOX_LAMAX=90
OPENSKY_BBOX_LOMAX=180

# Optional: polling interval (default: 30 seconds)
OPENSKY_POLL_INTERVAL=30000

# Optional: cache TTL (default: 60 minutes)
OPENSKY_TTL_MINUTES=60

# Optional: history retention (default: 7 days, 0 to disable)
AIRCRAFT_HISTORY_DAYS=7
```

#### Vessels Tracking (AISStream.io)

```bash
# AISStream.io API key (REQUIRED for vessels to work)
# Get a free API key at: https://aisstream.io
AISSTREAM_API_KEY=your_api_key_here

# Optional: bounding box (default: Arctic)
AISSTREAM_BBOX=[[[60,-180],[90,180]]]

# Optional: cache TTL (default: 60 minutes)
AISSTREAM_TTL_MINUTES=60

# Optional: history retention (default: 7 days, 0 to disable)
VESSEL_HISTORY_DAYS=7
```

### STAC Authentication

For STAC layers to work with TiTiler PGSTAC, ensure your `.env` has database credentials:

```bash
DB_HOST=db          # or localhost for local dev
DB_PORT=5432
DB_NAME=mmgis
DB_USER=postgres
DB_PASS=your_password_here
```

These same credentials are used by the adjacent STAC services (configured in `adjacent-servers/*/env.example` files).

## How the Plugins Work

### Aircraft Plugin

**Endpoints:**
- `GET /api/aircraft/live` - Current aircraft positions (GeoJSON)
- `GET /api/aircraft/track?icao24=xxx&hours=24` - Historical track
- `GET /api/aircraft/status` - Plugin diagnostics

**Data Flow:**
1. Backend polls OpenSky Network API every 30 seconds (configurable)
2. Positions cached in-memory (60-minute TTL by default)
3. Optionally persisted to PostgreSQL for historical playback
4. Frontend layer requests data via `/api/aircraft/live`
5. Layer auto-refreshes every 30 seconds (configured in mission JSON)

**Layer Configuration (already in mission):**
```json
{
  "name": "Aircraft (Live ADS-B)",
  "type": "vector",
  "url": "/api/aircraft/live",
  "time": {
    "enabled": true,
    "refreshIntervalEnabled": true,
    "refreshIntervalAmount": 30
  }
}
```

### Vessels Plugin

**Endpoints:**
- `GET /api/vessels/live` - Current vessel positions (GeoJSON)
- `GET /api/vessels/track?mmsi=xxx&hours=24` - Historical track
- `GET /api/vessels/in-ice?threshold=80` - Vessels in ice
- `GET /api/vessels/forecast-dates` - Available forecast dates
- `GET /api/vessels/status` - Plugin diagnostics

**Data Flow:**
1. WebSocket connection to AISStream.io (requires API key)
2. Real-time AIS messages streamed for configured bounding box
3. Positions cached in-memory (60-minute TTL by default)
4. Optionally persisted to PostGIS for historical playback
5. Frontend layer requests data via `/api/vessels/live`
6. Layer auto-refreshes every 60 seconds (configured in mission JSON)

**Layer Configuration (already in mission):**
```json
{
  "name": "Vessels (Live AIS)",
  "type": "vector",
  "url": "/api/vessels/live",
  "time": {
    "enabled": true,
    "refreshIntervalEnabled": true,
    "refreshIntervalAmount": 60
  }
}
```

## Restart Required

After adding the environment variables to `.env`:

```bash
# If using Docker
docker-compose restart mmgis

# If running locally
npm start
```

## Verification

1. **Check server logs on startup:**
   ```
   [Aircraft] Routes mounted at /api/aircraft
   [Vessels] Routes mounted at /api/vessels
   ```

2. **Test endpoints:**
   ```bash
   # Aircraft status
   curl http://localhost:8889/api/aircraft/status
   
   # Vessels status
   curl http://localhost:8889/api/vessels/status
   
   # Aircraft live data
   curl http://localhost:8889/api/aircraft/live
   
   # Vessels live data (requires API key)
   curl http://localhost:8889/api/vessels/live
   ```

3. **Frontend verification:**
   - Open MMGIS at http://localhost:8889
   - Open the Layers panel
   - Enable "Aircraft (Live ADS-B)" layer
   - Enable "Vessels (Live AIS)" layer (requires AISSTREAM_API_KEY)
   - Aircraft should appear as blue points
   - Vessels should appear as green points

## Troubleshooting

### Aircraft layer is empty
- **Cause:** `WITH_AIRCRAFT` not set to `true` in `.env`
- **Fix:** Add `WITH_AIRCRAFT=true` to `.env` and restart
- **Verification:** Check `/api/aircraft/status` - should show `"enabled": true`

### Vessels layer shows warning
- **Cause:** `AISSTREAM_API_KEY` not configured
- **Fix:** Get free API key from https://aisstream.io and add to `.env`
- **Verification:** Check `/api/vessels/status` - should not show "disabled"

### STAC layers not loading (Ice Forecast)
- **Cause:** STAC services can't authenticate to PostgreSQL
- **Fix:** Ensure `DB_USER` and `DB_PASS` are set in `.env`
- **Verification:** Check TiTiler PGSTAC logs: `docker-compose logs titiler-pgstac`

### No tracking history
- **Cause:** History persistence disabled or database not configured
- **Fix:** Set `AIRCRAFT_HISTORY_DAYS=7` (or desired days) and ensure PostgreSQL is running
- **Verification:** After plugin runs for a while, check `/api/aircraft/track?icao24=<some_icao>`

## Documentation Updates

The environment variable documentation in `docs/pages/Setup/ENVs/ENVs.md` has been updated to include all Aircraft and Vessels configuration options.

## Migration Notes

The original plugins in `API/MMGIS-Plugin-Backend/` can remain in place as a backup, but they are no longer loaded by the server. The active plugins are now in `plugins/core/backend/`.

If you need to revert these changes:
1. Remove `plugins/core/backend/Aircraft/` and `plugins/core/backend/Vessels/`
2. Remove `WITH_AIRCRAFT` and `AISSTREAM_API_KEY` from `.env`
3. Restart the server
