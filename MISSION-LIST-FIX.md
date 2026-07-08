# Mission List Fix - Status Report

## Problem
Mission list was not showing on the MMGIS landing page at http://localhost:8888

## Root Cause
Missions existed as JSON config files in `/Missions/` directory but were not imported into the PostgreSQL database. The MMGIS application loads missions from the `configs` table in the database, not directly from JSON files.

## Solution Applied

### 1. Created Mission Import Script
Created `import-missions.js` to import mission config files into the database.

**Key features:**
- Automatically finds all `*_config.json` files in `/Missions/`
- Parses JSON and extracts mission name
- Inserts into `configs` table with proper schema (mission, config, version, createdAt)
- Skips already-imported missions
- Shows summary of imported missions

### 2. Ran Import Inside Docker Container
```bash
docker cp import-missions.js mmgis-mmgis-1:/usr/src/app/
docker exec mmgis-mmgis-1 node import-missions.js
```

### 3. Successfully Imported 3 Missions

```
✅ Test (id: 4)
✅ frozon_ai_forecast (id: 5)
✅ frozon (id: 6)
```

## Verification

### Database Check
```bash
docker exec mmgis-db-1 psql -U postgres -d mmgis -c "SELECT id, mission FROM configs;"
```

Expected output:
```
 id |      mission       
----+--------------------
  4 | Test
  5 | frozon_ai_forecast
  6 | frozon
```

### Application Check
1. **Landing Page**: http://localhost:8888
   - Should show mission cards for Test, frozon_ai_forecast, and frozon
   - Click any mission to load it

2. **Configure Page**: http://localhost:8888/configure
   - Login with existing credentials
   - Should see all 3 missions in the missions dropdown

## Files Modified/Created

1. ✅ `import-missions.js` - Mission import utility script
2. ✅ Missions imported into `configs` table

## How to Import Additional Missions

If you add new mission config files to `/Missions/`:

### Method 1: Using the Import Script
```bash
# Copy new mission config file to Missions/
cp your_mission_v1_config.json /Users/kyun/Downloads/JPL/MMGIS/Missions/

# Run import script inside container
docker exec mmgis-mmgis-1 node import-missions.js
```

### Method 2: Via Configure UI (Recommended)
1. Go to http://localhost:8888/configure
2. Login as admin
3. Click "New Mission"
4. Configure mission settings
5. Save

## Understanding Mission Storage

### File System
- Location: `/Missions/`
- Format: `{mission_name}_v{version}_config.json`
- Purpose: Persistent storage, backups, version control

### Database
- Table: `configs`
- Columns: `id`, `mission`, `config` (JSON), `version`, `createdAt`
- Purpose: Active configuration used by the application

### Sync Process
- **Configure UI** → Updates both database AND file system
- **Direct File** → Only visible after import to database
- **Database** → Application reads from here

## Troubleshooting

### Mission not showing after import?
```bash
# 1. Check if it's in the database
docker exec mmgis-db-1 psql -U postgres -d mmgis -c "SELECT mission FROM configs;"

# 2. Restart MMGIS container
docker restart mmgis-mmgis-1

# 3. Check browser console for errors
# Open http://localhost:8888 and press F12
```

### Import script fails?
```bash
# Check if config file is valid JSON
docker exec mmgis-mmgis-1 node -e "require('/usr/src/app/Missions/your_mission_config.json')"

# Check database connectivity
docker exec mmgis-db-1 psql -U postgres -d mmgis -c "SELECT version();"
```

### Mission shows but won't load?
- Check that all referenced layers/data files exist in `/Missions/{mission_name}/`
- Verify layer URLs in the config are correct
- Check browser console for 404 errors

## Next Steps

1. **Test Mission Access**
   - Visit http://localhost:8888
   - Click on each mission to verify it loads
   - Check that layers display correctly

2. **Configure Missions** (if needed)
   - Login to http://localhost:8888/configure
   - Edit mission settings
   - Add/remove layers
   - Adjust map settings

3. **Add Reference Mission** (optional)
   - The frozon mission appears to be a full-featured demo
   - Test mission is a simpler example
   - You can create new missions via the Configure UI

## Mission Config Structure

Each mission config JSON contains:
```json
{
  "msv": {
    "mission": "mission_name",
    "site": "",
    "masterdb": false,
    ...
  },
  "configuration": {
    "projection": "...",
    "look": { ... },
    "tabs": [ ... ],
    "layers": [ ... ],
    ...
  }
}
```

## Mission Access URLs

Once missions are imported:
- **Frozon**: http://localhost:8888/?mission=frozon
- **Test**: http://localhost:8888/?mission=Test
- **Frozon AI Forecast**: http://localhost:8888/?mission=frozon_ai_forecast

Or just go to http://localhost:8888 to see the landing page with all missions.

---
**Fix completed**: 2026-07-01
**Missions imported**: 3
**Status**: ✅ Ready
