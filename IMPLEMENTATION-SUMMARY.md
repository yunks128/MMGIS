# Aircraft and Vessels Tracking Layers - Implementation Summary

## Problem Identified

The Aircraft and Vessels tracking layers were not showing in MMGIS because:

1. **Incorrect Plugin Location**: Plugins were in `API/MMGIS-Plugin-Backend/` but the plugin discovery system only scans `plugins/*/backend/`
2. **Missing Plugin Manifests**: No `plugin.json` files existed for plugin discovery
3. **Incorrect File Names**: Used `setup.js` instead of required `plugin.js`
4. **Environment Variables Not Set**: `WITH_AIRCRAFT` and `AISSTREAM_API_KEY` not configured

## Solution Implemented

### 1. Plugin Migration (Completed)

**Moved plugins to correct location:**
- `API/MMGIS-Plugin-Backend/Aircraft/` → `plugins/core/backend/Aircraft/`
- `API/MMGIS-Plugin-Backend/Vessels/` → `plugins/core/backend/Vessels/`

**Files in each plugin:**
- `plugin.js` - Lifecycle hooks (renamed from setup.js)
- `plugin.json` - Plugin manifest (newly created)
- `routes/` - Express route handlers
- `models/` - Sequelize database models
- Client code and utilities

### 2. Git Commits Created

```
4d2084e7 docs: add template for .env additions
45b28d83 docs: add quick start guide for tracking layers
d544eff4 feat: enable Aircraft and Vessels tracking layers
```

### 3. Documentation Created

- **TRACKING-LAYERS-SETUP.md** - Complete technical documentation
- **QUICK-START-TRACKING.md** - Quick start guide for users
- **ENV-ADDITIONS.txt** - Template for .env file additions

## Required User Actions

### Step 1: Add to `.env` file

Copy from `ENV-ADDITIONS.txt` or add manually:

```bash
# Aircraft (works immediately, no API key needed)
WITH_AIRCRAFT=true
OPENSKY_BBOX_LAMIN=66.5
OPENSKY_BBOX_LOMIN=-180
OPENSKY_BBOX_LAMAX=90
OPENSKY_BBOX_LOMAX=180
OPENSKY_POLL_INTERVAL=30000
OPENSKY_TTL_MINUTES=60
AIRCRAFT_HISTORY_DAYS=7

# Vessels (requires free API key from https://aisstream.io)
AISSTREAM_API_KEY=your_api_key_here
AISSTREAM_BBOX=[[[60,-180],[90,180]]]
AISSTREAM_TTL_MINUTES=60
VESSEL_HISTORY_DAYS=7
```

### Step 2: Get AISStream API Key (for Vessels only)

1. Visit https://aisstream.io
2. Sign up (instant, free)
3. Copy API key
4. Add to `.env`: `AISSTREAM_API_KEY=your_key`

### Step 3: Merge the branch

From the main working directory:

```bash
# Check current branch
git branch

# Merge the worktree branch
git merge worktree-fix-stac-tracking-layers

# Or cherry-pick the commits
git cherry-pick d544eff4 45b28d83 4d2084e7
```

### Step 4: Restart MMGIS

```bash
# Docker
docker-compose restart mmgis

# Local
npm start
```

## Verification Steps

### 1. Check Server Logs

Should see on startup:
```
[Aircraft] Routes mounted at /api/aircraft
[Vessels] Routes mounted at /api/vessels
```

### 2. Test Endpoints

```bash
curl http://localhost:8889/api/aircraft/status
# Should return: {"enabled": true, ...}

curl http://localhost:8889/api/vessels/status
# Should return vessel feed status (not "disabled")

curl http://localhost:8889/api/aircraft/live
# Should return GeoJSON with aircraft features

curl http://localhost:8889/api/vessels/live
# Should return GeoJSON with vessel features
```

### 3. Test in Browser

1. Open http://localhost:8889 (dev) or :8888 (prod)
2. Open Layers panel (left sidebar)
3. Enable "Aircraft (Live ADS-B)"
   - Should see blue points for aircraft
4. Enable "Vessels (Live AIS)"
   - Should see green points for vessels
5. Click any aircraft/vessel
   - Should show popup with details
   - Should show 24-hour track line

## STAC Layers Status

STAC layers (Ice Forecast) should also work if:
- `DB_USER` and `DB_PASS` are set in `.env`
- TiTiler PGSTAC service is running
- STAC database has been initialized

The user mentioned `.env is updated`, so STAC authentication should already be configured.

## Technical Details

### How Plugin Discovery Works

1. `API/setups.js` scans `plugins/*/backend/` directories
2. Looks for `plugin.json` manifests
3. Loads sibling `plugin.js` for lifecycle hooks
4. Calls hooks in order: `onceInit` → `onceStarted` → `onceSynced`
5. Mounts routes and initializes services

### Aircraft Plugin Architecture

- **Client**: `openskyClient.js` - Polls OpenSky Network API
- **Routes**: `/api/aircraft/live`, `/track`, `/status`
- **Model**: `aircraftPosition.js` - PostgreSQL persistence
- **Updates**: Every 30 seconds by default
- **History**: Optional PostgreSQL storage (7 days default)

### Vessels Plugin Architecture

- **Client**: `aisstreamClient.js` - WebSocket to AISStream.io
- **Routes**: `/api/vessels/live`, `/track`, `/in-ice`, `/status`
- **Model**: `vesselPosition.js` - PostGIS persistence
- **Updates**: Real-time via WebSocket
- **History**: Optional PostGIS storage (7 days default)

## Files Changed

```
plugins/core/backend/Aircraft/
├── models/aircraftPosition.js
├── openskyClient.js
├── plugin.js (renamed from setup.js)
├── plugin.json (new)
└── routes/aircraft.js

plugins/core/backend/Vessels/
├── models/vesselPosition.js
├── aisstreamClient.js
├── iceSampler.js
├── midTable.js
├── plugin.js (renamed from setup.js)
├── plugin.json (new)
└── routes/vessels.js

Documentation:
├── TRACKING-LAYERS-SETUP.md (new)
├── QUICK-START-TRACKING.md (new)
└── ENV-ADDITIONS.txt (new)
```

## Success Criteria

✅ Plugins moved to correct location
✅ Plugin manifests created
✅ File names corrected (setup.js → plugin.js)
✅ Documentation created
✅ Git commits made
⏳ User must add env vars and restart (next step)
⏳ User must get AISStream API key (for vessels)

## Next Steps for User

1. ✏️ Edit `.env` - add variables from `ENV-ADDITIONS.txt`
2. 🔑 Get AISStream API key from https://aisstream.io
3. 🔄 Restart MMGIS server
4. ✅ Verify layers appear in browser
5. 🔀 Merge worktree branch to main

## Support

If issues persist after following steps:
- Check `TRACKING-LAYERS-SETUP.md` for troubleshooting
- Verify plugins exist in `plugins/core/backend/`
- Check server logs for plugin loading messages
- Test API endpoints directly with curl
