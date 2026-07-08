# Missing Layers Status Report

## Summary

### ✅ FIXED
- **Aircraft (Live ADS-B)**: Working, 14 aircraft tracked
- **STAC API**: Now enabled and accessible

### ⚠️ REQUIRES DATA
- **SFNO Prediction Layers**: STAC collections don't exist in database
- **Vessels (Live AIS)**: API working but needs AISSTREAM_API_KEY

## Detailed Status

### 1. Aircraft Layer: ✅ WORKING

**Status**: Fully operational  
**API**: http://localhost:8888/api/aircraft/live  
**Current Data**: 14 aircraft tracked  
**Update Interval**: 30 seconds  

**Action Required**: None - working perfectly

### 2. SFNO Forecast Layers: ⚠️ NO DATA

**Status**: Configured but no STAC collections in database  
**Issue**: The layers reference STAC collection IDs that don't exist:
- `forecast-7day-PRED` (SFNO Prediction Daily 10 km 2022-2024)
- `forecast-7day-GRND` (SFNO Ground Truth Daily 10 km 2022-2024)

**STAC API Status**:
- ✅ Enabled (WITH_STAC=true)
- ✅ Accessible at http://localhost:8888/api/stac/
- ⚠️ **0 collections in database**

**Why Layers Don't Show**:
The Ice Forecast header layer has 2 sublayers that use STAC collections:
```json
{
  "name": "SFNO Prediction Daily 10 km 2022-2024",
  "type": "tile",
  "sourceType": "stac-collection",
  "url": "forecast-7day-PRED"   // ← Collection ID
}
```

When MMGIS tries to load this layer:
1. Sends request to `/api/stac/collections/forecast-7day-PRED`
2. STAC returns 404 (collection doesn't exist)
3. Layer fails to display

**How to Fix**:

#### Option 1: Load Real SFNO Data (Recommended if you have it)
If you have the actual forecast data:
1. Create STAC collections for the forecast data
2. Ingest items into the collections
3. Collections will become available through STAC API

#### Option 2: Remove SFNO Layers (If you don't have the data)
Remove the Ice Forecast layer from the mission config:
```bash
# Run this to remove SFNO layers
docker exec mmgis-mmgis-1 node -e "
const fs = require('fs');
const path = require('path');
const c = JSON.parse(fs.readFileSync('/usr/src/app/Missions/frozon_ai_forecast_v38_config.json'));
c.layers = c.layers.filter(l => l.name !== 'Ice Forecast');
fs.writeFileSync('/usr/src/app/Missions/frozon_ai_forecast_v38_config.json', JSON.stringify(c, null, 2));
console.log('Removed Ice Forecast layer');
"

# Then update database
docker exec mmgis-mmgis-1 node force-update-mission.js
```

#### Option 3: Use Different Data Source
Change the sublayers to use a different tile source (not STAC):
- Could use GIBS imagery
- Could use COG (Cloud-Optimized GeoTIFF) files
- Could use regular tile server

**Check STAC Collections**:
```bash
# List all collections
curl http://localhost:8888/api/stac/collections | jq '.collections[] | .id'

# Should show: (currently empty)
# forecast-7day-PRED
# forecast-7day-GRND
```

### 3. Vessels Layer: ⚠️ NEEDS API KEY

**Status**: API endpoint working, but no data (no API key)  
**API**: http://localhost:8888/api/vessels/live  
**Current Response**: 
```json
{
  "type": "FeatureCollection",
  "features": [],
  "_meta": {"mode": "live", "count": 0}
}
```

**Why No Data**:
```
[AisStreamClient] No AISSTREAM_API_KEY set — vessel feed disabled.
```

**How to Fix**:

1. **Get Free API Key**:
   - Visit: https://aisstream.io
   - Create free account
   - Get API key from dashboard

2. **Configure in .env**:
   ```env
   AISSTREAM_API_KEY=your_api_key_here
   AISSTREAM_BBOX=-30,55,40,82
   WITH_VESSELS=true
   ```

3. **Restart Container**:
   ```bash
   docker restart mmgis-mmgis-1
   ```

4. **Verify**:
   ```bash
   curl http://localhost:8888/api/vessels/status
   # Should show: "enabled": true, "isRunning": true
   
   curl http://localhost:8888/api/vessels/live | jq '.features | length'
   # Should show: > 0 vessels
   ```

**Expected Result**: 
- Arctic shipping season (summer): 50-200 vessels
- Winter: 5-30 vessels
- Coverage: Atlantic to Arctic shipping corridors

## Current Layer Status in Browser

After hard refresh (Ctrl+Shift+R), you should see:

```
✓ Land Mask                               → ✅ Working
✓ Ice Forecast                            → ⚠️ Header shows, sublayers don't work
  ├─ SFNO Prediction (forecast-7day-PRED) → ❌ No STAC collection
  └─ SFNO Ground Truth (forecast-7day-GRND)→ ❌ No STAC collection
✓ GIBS MODIS True Color                   → ✅ Working
✓ GIBS Blue Marble                        → ✅ Working
✓ Vessels (Live AIS)                      → ⚠️ Shows but empty (no API key)
✓ Aircraft (Live ADS-B)                   → ✅ Working (14 aircraft)
```

## Quick Verification Commands

```bash
# 1. Check STAC is enabled
docker exec mmgis-mmgis-1 node -e "require('dotenv').config(); console.log('WITH_STAC:', process.env.WITH_STAC);"
# Should show: WITH_STAC: true

# 2. Check STAC collections
curl http://localhost:8888/api/stac/collections | jq '.collections | length'
# Currently shows: 0 (need to load data)

# 3. Check vessels API
curl http://localhost:8888/api/vessels/live | jq '{count: .features | length, has_key: (.features | length > 0)}'
# Currently shows: count: 0, has_key: false (need API key)

# 4. Check aircraft API
curl http://localhost:8888/api/aircraft/live | jq '.features | length'
# Should show: 10-20 (working!)
```

## Recommendations

### Immediate Actions:

1. **Aircraft Layer** - ✅ Already working
   - Hard refresh browser (Ctrl+Shift+R)
   - Enable layer in Layers tool
   - Should see 14 aircraft immediately

2. **Vessels Layer** - Get API key if needed
   - If you need vessel tracking: Get key from https://aisstream.io
   - Add to .env and restart
   - Otherwise: Layer will show but be empty (this is fine)

3. **SFNO Layers** - Decide what to do:
   - **Option A**: If you have forecast data → Load into STAC
   - **Option B**: If you don't need them → Remove from config
   - **Option C**: Replace with different data source

### Long-term:

1. **For SFNO Forecast Data**:
   - Need actual geospatial forecast data
   - Need to create STAC collections
   - Need to ingest data items
   - This requires data science/GIS expertise

2. **For Vessels**:
   - Free tier from AISStream.io: 5,000 messages/day
   - Paid tiers for higher volume
   - Alternative: Different AIS data source

## Files Created/Modified

1. ✅ `.env` - Added `WITH_STAC=true`
2. ✅ `fix-missing-layers.sh` - Diagnostic and fix script
3. ✅ `MISSING-LAYERS-STATUS.md` - This file

## Next Steps

Choose one:

### Path A: Use Only Working Layers (Recommended for Now)
```bash
# Aircraft works, vessels empty but harmless
# Just hard refresh browser and enjoy aircraft tracking
# SFNO layers will show as "not loaded" - that's expected
```

### Path B: Remove SFNO Layers
```bash
# If you don't have forecast data, remove those layers
# This will clean up the UI
```

### Path C: Enable Vessels + Fix SFNO
```bash
# 1. Get AISSTREAM_API_KEY
# 2. Load SFNO forecast data into STAC
# 3. Full functionality
```

## Summary

| Layer | Status | Action |
|-------|--------|--------|
| Aircraft | ✅ Working | Hard refresh browser |
| Vessels | ⚠️ Empty | Optional: Add API key |
| SFNO Forecast | ❌ No data | Need to load STAC collections |

**Bottom line**: Aircraft tracking works perfectly. Vessels and SFNO need additional data/configuration.

---
**Updated**: 2026-07-01  
**Aircraft**: ✅ 14 tracked  
**Vessels**: ⚠️ API ready, needs key  
**SFNO**: ⚠️ Needs STAC collections
