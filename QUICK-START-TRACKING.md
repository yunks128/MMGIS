# Quick Start: Enable Aircraft and Vessels Tracking

## What Was Fixed

The Aircraft and Vessels tracking plugins were not loading because they were in the wrong directory (`API/MMGIS-Plugin-Backend/`) instead of the standard plugin location (`plugins/core/backend/`).

**Solution:** Moved plugins to correct location and added required `plugin.json` manifests.

## Required Steps to Enable

### 1. Add to `.env` file

```bash
# Aircraft Tracking (OpenSky Network - FREE, no API key needed)
WITH_AIRCRAFT=true

# Vessels Tracking (AISStream.io - requires free API key)
AISSTREAM_API_KEY=your_key_here

# Optional: Keep defaults or customize
OPENSKY_BBOX_LAMIN=66.5      # Arctic Circle
OPENSKY_BBOX_LOMIN=-180
OPENSKY_BBOX_LAMAX=90        # North Pole
OPENSKY_BBOX_LOMAX=180
OPENSKY_POLL_INTERVAL=30000  # 30 seconds
AIRCRAFT_HISTORY_DAYS=7

AISSTREAM_TTL_MINUTES=60
VESSEL_HISTORY_DAYS=7
```

### 2. Get AISStream.io API Key (for Vessels only)

1. Go to https://aisstream.io
2. Sign up (instant, free)
3. Copy your API key
4. Add to `.env`: `AISSTREAM_API_KEY=your_key_here`

### 3. Restart MMGIS

```bash
# Docker
docker-compose restart mmgis

# Local
npm start
```

## Verification

### Check Server Logs

Look for these lines on startup:
```
[Aircraft] Routes mounted at /api/aircraft
[Vessels] Routes mounted at /api/vessels
```

### Test Endpoints

```bash
# Aircraft (should work immediately if WITH_AIRCRAFT=true)
curl http://localhost:8889/api/aircraft/status
curl http://localhost:8889/api/aircraft/live

# Vessels (requires AISSTREAM_API_KEY)
curl http://localhost:8889/api/vessels/status
curl http://localhost:8889/api/vessels/live
```

### Frontend Check

1. Open http://localhost:8889 (or :8888 for production)
2. Open Layers panel (left sidebar)
3. Find "Aircraft (Live ADS-B)" and toggle it on
4. Find "Vessels (Live AIS)" and toggle it on
5. You should see:
   - **Aircraft:** Blue points showing live aircraft positions
   - **Vessels:** Green points showing live ship positions

## STAC Layers (Ice Forecast)

STAC layers should work if your `.env` has valid database credentials:

```bash
DB_HOST=db          # or localhost
DB_PORT=5432
DB_NAME=mmgis
DB_USER=postgres
DB_PASS=your_password
```

The STAC services (TiTiler PGSTAC, STAC API) use these same credentials to connect to the `mmgis-stac` database.

## Common Issues

### Aircraft layer empty
- **Missing:** `WITH_AIRCRAFT=true` in `.env`
- **Fix:** Add it and restart

### Vessels layer shows warning
- **Missing:** `AISSTREAM_API_KEY` in `.env`
- **Fix:** Get free key from https://aisstream.io

### STAC layers not loading
- **Issue:** Database credentials not set
- **Fix:** Check `DB_USER` and `DB_PASS` in `.env`

### Plugins not loading
- **Issue:** Old plugin location still being used
- **Fix:** Verify files exist in `plugins/core/backend/Aircraft/` and `plugins/core/backend/Vessels/`

## What's Next

After enabling, you can:
- **Click any aircraft/vessel** to see detailed info and 24-hour track
- **Filter by bounds** using URL params: `/api/aircraft/live?bounds=minLon,minLat,maxLon,maxLat`
- **Historical replay** using the time slider (requires history persistence enabled)
- **Vessels in ice** analysis: `/api/vessels/in-ice?threshold=80`

## Full Documentation

See `TRACKING-LAYERS-SETUP.md` for complete details on:
- Plugin architecture
- API endpoints
- Configuration options
- Troubleshooting
- Migration notes
