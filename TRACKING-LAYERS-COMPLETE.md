# ✅ Vessel & Aircraft Tracking Layers - Complete

## Status: Aircraft Tracking ENABLED ✈️

The frozon_ai_forecast mission now has vessel and aircraft tracking layers configured and aircraft tracking is fully operational.

## What Was Done

### 1. Added Tracking Layers to Mission Config ✅
Created and ran `add-tracking-layers.js` script which:
- Added "Vessels (Live AIS)" layer to frozon_ai_forecast mission
- Added "Aircraft (Live ADS-B)" layer to frozon_ai_forecast mission
- Updated both database and JSON config file
- Assigned unique UUIDs to each layer

### 2. Enabled Aircraft Tracking ✅
Created and ran `enable-tracking.sh` script which:
- Set `WITH_AIRCRAFT=true` in .env
- Configured Arctic Circle bounding box (66.5°N - 90°N)
- Set poll interval and TTL defaults

### 3. Fixed Aircraft Plugin Syntax Error ✅
- Corrected syntax error in `Aircraft/setup.js` (line 78: `},` → `]`)
- Plugin now loads successfully

### 4. Verified Aircraft Tracking ✅
- Plugin loaded: ✅
- Routes mounted: ✅
- Polling active: ✅ (10 aircraft detected)
- API responding: ✅

## Current Status

### Aircraft Tracking (Live ADS-B)
```json
{
  "enabled": true,
  "isRunning": true,
  "cacheSize": 10,
  "bbox": {
    "lamin": 66.5,    // Arctic Circle
    "lomin": -180,
    "lamax": 90,      // North Pole  
    "lomax": 180
  },
  "pollIntervalMs": 60000,  // 60 seconds
  "ttlMs": 3600000          // 60 minutes
}
```

**Data Source**: OpenSky Network (free, public API)  
**Coverage**: Full Arctic Circle (66.5°N and above)  
**Update Interval**: 60 seconds  
**Current Aircraft**: 10 tracked

### Vessel Tracking (Live AIS)
```
Status: DISABLED (no API key)
Requirement: AISSTREAM_API_KEY from https://aisstream.io
```

## Access the Tracking Layers

### Step 1: Open the Mission
Navigate to: http://localhost:8888/?mission=frozon_ai_forecast

### Step 2: Enable Layers
1. Click the **Layers** tool in the left toolbar (📚 icon)
2. Scroll down to find:
   - **Aircraft (Live ADS-B)** - Toggle ON
   - **Vessels (Live AIS)** - (requires API key)
3. Aircraft markers will appear on the map

### Step 3: Interact with Aircraft
- **Click any aircraft marker** to see:
  - Callsign
  - ICAO24 address
  - Origin country
  - Altitude (meters)
  - Velocity (m/s)
  - Heading (degrees)
  - On ground status
  - Last contact time
- **Auto-refresh**: Data updates every 60 seconds

## Layer Configuration

### Aircraft Layer
```json
{
  "name": "Aircraft (Live ADS-B)",
  "type": "vector",
  "url": "/api/aircraft/live",
  "visibility": false,
  "time": {
    "enabled": true,
    "type": "requery",
    "refreshIntervalEnabled": true,
    "refreshIntervalAmount": 30
  },
  "style": {
    "radius": 6,
    "fillColor": "#2563eb",
    "color": "#ffffff",
    "weight": 1,
    "fillOpacity": 0.85
  }
}
```

### Vessel Layer
```json
{
  "name": "Vessels (Live AIS)",
  "type": "vector",
  "url": "/api/vessels/live",
  "visibility": false,
  "time": {
    "enabled": true,
    "type": "requery",
    "refreshIntervalEnabled": true,
    "refreshIntervalAmount": 60
  },
  "style": {
    "radius": 6,
    "fillColor": "#10b981",
    "color": "#ffffff",
    "weight": 1,
    "fillOpacity": 0.85
  }
}
```

## Enabling Vessel Tracking

To enable vessel tracking, you need an AISStream.io API key:

### Step 1: Get API Key
1. Visit https://aisstream.io
2. Create a free account
3. Get your API key from the dashboard

### Step 2: Configure Environment
Add to `.env` file:
```env
AISSTREAM_API_KEY=your_api_key_here
AISSTREAM_BBOX=-30,55,40,82
WITH_VESSELS=true
```

The bounding box `-30,55,40,82` covers:
- Longitude: -30° to 40° (Atlantic to Europe)
- Latitude: 55° to 82° (Arctic shipping corridors)

### Step 3: Restart Container
```bash
docker restart mmgis-mmgis-1
```

### Step 4: Verify
```bash
curl http://localhost:8888/api/vessels/status
```

## API Endpoints

### Aircraft
- **GET /api/aircraft/live** - GeoJSON FeatureCollection of current aircraft
- **GET /api/aircraft/track?icao24=XXX** - 24-hour track for specific aircraft
- **GET /api/aircraft/status** - Plugin status and diagnostics

### Vessels
- **GET /api/vessels/live** - GeoJSON FeatureCollection of current vessels
- **GET /api/vessels/track?mmsi=XXX** - 24-hour track for specific vessel
- **GET /api/vessels/status** - Plugin status and diagnostics

## Environment Variables

### Aircraft Tracking
```env
WITH_AIRCRAFT=true                 # Enable aircraft tracking
OPENSKY_BBOX_LAMIN=66.5           # Min latitude (Arctic Circle)
OPENSKY_BBOX_LOMIN=-180           # Min longitude
OPENSKY_BBOX_LAMAX=90             # Max latitude (North Pole)
OPENSKY_BBOX_LOMAX=180            # Max longitude
OPENSKY_POLL_INTERVAL=60000       # Poll interval (ms)
OPENSKY_TTL_MINUTES=60            # Cache TTL (minutes)
AIRCRAFT_HISTORY_DAYS=7           # PostgreSQL retention (days)
```

### Vessel Tracking
```env
WITH_VESSELS=true                  # Enable vessel tracking
AISSTREAM_API_KEY=your_key        # AISStream.io API key (required)
AISSTREAM_BBOX=-30,55,40,82       # Bounding box (lon_min,lat_min,lon_max,lat_max)
AISSTREAM_TTL_MINUTES=30          # Cache TTL (minutes)
VESSEL_HISTORY_DAYS=7             # PostgreSQL retention (days)
```

## Testing the Layers

### Aircraft Tracking Test
```bash
# Check status
curl http://localhost:8888/api/aircraft/status | jq .

# Get live aircraft (GeoJSON)
curl http://localhost:8888/api/aircraft/live | jq .

# Get count
curl http://localhost:8888/api/aircraft/live | jq '.features | length'

# Get sample aircraft
curl http://localhost:8888/api/aircraft/live | jq '.features[0]'
```

### Vessel Tracking Test (when enabled)
```bash
# Check status
curl http://localhost:8888/api/vessels/status | jq .

# Get live vessels
curl http://localhost:8888/api/vessels/live | jq .
```

## Data Coverage Notes

### Aircraft (ADS-B)
- **Best coverage**: Northern Europe, Russia, Alaska, Canada
- **Limited coverage**: Remote Arctic Ocean, Greenland interior
- **Reason**: ADS-B requires ground stations; sparse in remote areas
- **Typical count**: 5-50 aircraft depending on time/location

### Vessels (AIS)
- **Best coverage**: Shipping lanes, coastal areas
- **Limited coverage**: Remote Arctic waters
- **Reason**: AIS requires satellite/terrestrial receivers
- **Typical count**: Varies by season (summer: 50-200, winter: 5-30)

## Troubleshooting

### Aircraft layer not showing data?
```bash
# Check if plugin is enabled
docker logs mmgis-mmgis-1 | grep Aircraft

# Check API status
curl http://localhost:8888/api/aircraft/status

# Check for data
curl http://localhost:8888/api/aircraft/live | jq '.features | length'

# If 0 aircraft, try broader bbox or wait a few minutes
```

### Vessel layer not showing?
```bash
# Verify API key is set
docker exec mmgis-mmgis-1 node -e "require('dotenv').config(); console.log('AISSTREAM_API_KEY:', process.env.AISSTREAM_API_KEY ? 'SET' : 'NOT SET');"

# Check plugin loaded
docker logs mmgis-mmgis-1 | grep Vessel

# Test API
curl http://localhost:8888/api/vessels/status
```

### Layer appears but no markers?
- **Aircraft**: May be sparse depending on time of day and location
- **Vessels**: Arctic shipping is seasonal; winter has minimal traffic
- **Both**: Check browser console (F12) for errors
- **Both**: Verify TIME controls are enabled and not filtering out data

## Files Modified/Created

### Created
1. ✅ `add-tracking-layers.js` - Script to add layers to mission config
2. ✅ `enable-tracking.sh` - Script to configure environment variables
3. ✅ `TRACKING-LAYERS-COMPLETE.md` - This file

### Modified
1. ✅ `.env` - Added WITH_AIRCRAFT=true and OpenSky config
2. ✅ `Missions/frozon_ai_forecast_v38_config.json` - Added 2 tracking layers
3. ✅ Database `configs` table - Updated frozon_ai_forecast mission
4. ✅ `API/MMGIS-Plugin-Backend/Aircraft/setup.js` - Fixed syntax error (line 78)

## Mission Layer Summary

The frozon_ai_forecast mission now has **6 layers**:

1. Land Mask (tile)
2. Ice Forecast (header)
3. GIBS MODIS True Color (tile)
4. GIBS Blue Marble (tile)
5. **Vessels (Live AIS)** ⭐ NEW (requires API key)
6. **Aircraft (Live ADS-B)** ⭐ NEW ✅ WORKING

## Next Steps

### For Aircraft Tracking (Already Working)
✅ Visit http://localhost:8888/?mission=frozon_ai_forecast  
✅ Enable "Aircraft (Live ADS-B)" layer  
✅ See live aircraft on the map  

### For Vessel Tracking (Needs API Key)
1. Get free API key from https://aisstream.io
2. Add to `.env`: `AISSTREAM_API_KEY=your_key_here`
3. Add to `.env`: `WITH_VESSELS=true`
4. Restart: `docker restart mmgis-mmgis-1`
5. Enable "Vessels (Live AIS)" layer in mission

## Support

### OpenSky Network
- Website: https://opensky-network.org
- API Docs: https://openskynetwork.github.io/opensky-api/
- Status: Free, public API (no key required)

### AISStream.io
- Website: https://aisstream.io
- API Docs: https://aisstream.io/documentation
- Pricing: Free tier available

---
**Fix completed**: 2026-07-01  
**Aircraft Tracking**: ✅ OPERATIONAL  
**Vessel Tracking**: ⏸️ READY (needs API key)  
**Mission**: http://localhost:8888/?mission=frozon_ai_forecast
