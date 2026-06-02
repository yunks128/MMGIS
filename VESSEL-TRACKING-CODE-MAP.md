# Vessel Tracking & Real-Time AIS Integration - Code Map

**Project:** MMGIS Frozon Arctic Mission  
**Feature:** Real-time vessel tracking with AISStream.io WebSocket  
**Status:** ✅ Implemented and operational  
**Date:** June 2026

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Backend Components](#backend-components)
3. [Frontend Components](#frontend-components)
4. [Data Flow](#data-flow)
5. [API Endpoints](#api-endpoints)
6. [Environment Configuration](#environment-configuration)
7. [Database Schema](#database-schema)
8. [Layer Configuration](#layer-configuration)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  AISStream.io WebSocket Feed (wss://stream.aisstream.io/v0/stream)  │
│  Global AIS data · Arctic focus · Free tier · ~3,000 vessels        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ WebSocket connection
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND PLUGIN: Frozon-MMGIS-Plugin-Backend/Vessels/               │
│                                                                       │
│  ┌─────────────────────┐    ┌──────────────────┐                   │
│  │ aisstreamClient.js  │───▶│  In-Memory Cache │                   │
│  │ WebSocket Client    │    │  Map<MMSI, pos>  │                   │
│  │ - connects          │    │  TTL eviction    │                   │
│  │ - subscribes bbox   │    │  (60 min default)│                   │
│  │ - merges pos + meta │    └────────┬─────────┘                   │
│  └─────────────────────┘             │                              │
│                                       │                              │
│                           ┌───────────▼──────────┐                  │
│                           │  Persist Throttle    │                  │
│                           │  (1 row/MMSI/min)    │                  │
│                           └───────────┬──────────┘                  │
│                                       │                              │
│                           ┌───────────▼──────────────────────────┐  │
│                           │  PostgreSQL + PostGIS                │  │
│                           │  vessel_positions table              │  │
│                           │  - mmsi, lat, lon, speed, course     │  │
│                           │  - t_utc (timestamp)                 │  │
│                           │  - 7-day rolling retention           │  │
│                           │  - indexed by (mmsi, t_utc DESC)     │  │
│                           └───────────┬──────────────────────────┘  │
│                                       │                              │
│  ┌────────────────────────────────────▼──────────────────────────┐  │
│  │  REST API Routes (routes/vessels.js)                          │  │
│  │  GET /api/vessels/live?bounds&types&flags&at&windowMinutes    │  │
│  │  GET /api/vessels/track?mmsi=...                              │  │
│  │  GET /api/vessels/in-ice                                      │  │
│  │  GET /api/vessels/forecast-dates                              │  │
│  │  GET /api/vessels/status                                      │  │
│  └────────────────────────────────────┬──────────────────────────┘  │
└─────────────────────────────────────┬─┘                              
                                      │ HTTP/JSON                      
                                      │                                
┌─────────────────────────────────────▼─────────────────────────────┐
│  FRONTEND: MMGIS Core + Plugin-Tools                               │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  MMGIS Vector Layer Config                                  │   │
│  │  name: "Vessels (Live AIS)"                                │   │
│  │  type: vector                                               │   │
│  │  url: /api/vessels/live                                     │   │
│  │  time.enabled: true                                         │   │
│  │  time.endtime: "{endtime}" → replaced by time slider       │   │
│  │  refreshIntervalAmount: 30 sec                              │   │
│  └────────────┬───────────────────────────────────────────────┘   │
│               │                                                     │
│  ┌────────────▼───────────────────────────────────────────────┐   │
│  │  Leaflet Map Rendering (L_.layers)                         │   │
│  │  - Circle markers at vessel positions                      │   │
│  │  - Auto-refresh every 30 sec                              │   │
│  │  - Time slider triggers ?at= historical query             │   │
│  └────────────┬───────────────────────────────────────────────┘   │
│               │                                                     │
│  ┌────────────▼───────────────────────────────────────────────┐   │
│  │  Vessel Popups (renderers.js)                             │   │
│  │  rebindVesselPopups() — idempotent, every 2 sec           │   │
│  │  - Name, MMSI, Flag, Speed, Course, Heading               │   │
│  │  - Nav status, Position, Age                              │   │
│  │  - Links: MarineTraffic, VesselFinder                     │   │
│  │  - Click → draw track (GET /api/vessels/track)            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Copilot Chat Tools (AgentChat/renderers.js)              │   │
│  │  - show_vessels_in_area                                    │   │
│  │  - get_vessel_track                                        │   │
│  │  - vessel_ice_crossings                                    │   │
│  └────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Backend Components

All backend code is in the **Frozon-MMGIS-Plugin-Backend** plugin:

### Core Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| **Vessels/setup.js** | Plugin registration & lifecycle | `onceInit`, `onceStarted`, `onceSynced` |
| **Vessels/aisstreamClient.js** | WebSocket client for AISStream.io | `AisStreamClient` class, connection management, cache |
| **Vessels/routes/vessels.js** | Express REST endpoints | `/live`, `/track`, `/in-ice`, `/status` |
| **Vessels/models/vesselPosition.js** | Sequelize model for PostGIS | `vessel_positions` table schema |
| **Vessels/midTable.js** | MMSI → Country code decoder | MID table lookup (269 countries) |
| **Vessels/iceSampler.js** | Ice concentration sampling | Reads PRED layer TIFFs, samples at vessel positions |
| **VesselTracking/** | Legacy implementation (superceded) | Use `Vessels/` instead |

### Key Classes & Functions

#### **AisStreamClient** (aisstreamClient.js)

```javascript
class AisStreamClient {
  constructor({ apiKey, boundingBoxes, ttlMs, logger, onPositionPersist, VesselPosition })
  
  // Main lifecycle
  start()                          // Connect to WebSocket, start eviction timer
  stop()                           // Disconnect, clear timers
  
  // Data access
  getVessels(opts)                 // Returns array of vessel objects (live cache)
  getHistoricalSnapshot(at, opts)  // Queries PostGIS for positions at timestamp
  getTrack(mmsi, opts)             // Returns historical track for one vessel
  
  // Internal
  _connect()                       // WebSocket connection with retry backoff
  _handleMessage(msg)              // Parse AIS PositionReport + ShipStaticData
  _evictStale()                    // Remove vessels older than TTL
  _flushPersistQueue()             // Batch insert to vessel_positions table
}
```

**WebSocket URL:** `wss://stream.aisstream.io/v0/stream`  
**Subscription format:**
```json
{
  "APIKey": "...",
  "BoundingBoxes": [[[60, -180], [90, 180]]]  // lat,lon (not lon,lat!)
}
```

#### **REST API Routes** (routes/vessels.js)

```javascript
// GET /api/vessels/live?bounds&types&flags&at&windowMinutes
// Returns GeoJSON FeatureCollection
// - bounds: minLon,minLat,maxLon,maxLat
// - types: Cargo,Tanker (comma-separated, case-insensitive)
// - flags: NO,RU,US (ISO2 country codes)
// - at: ISO8601 timestamp (triggers historical mode)
// - windowMinutes: look-back window for historical query (default 60)

router.get("/live", async (req, res) => {
  // Mode 1: Live cache (default)
  // Mode 2: Historical snapshot (when at= is provided and not "now")
  // Mode 3: Live fallback (when historical query returns empty)
})

// GET /api/vessels/track?mmsi=123456789
// Returns GeoJSON LineString of last 200 positions for one vessel
router.get("/track", async (req, res) => {
  // Pulls from PostGIS vessel_positions table
  // Ordered by t_utc DESC
})

// GET /api/vessels/in-ice
// Returns vessels currently in >= 15% ice concentration
router.get("/in-ice", async (req, res) => {
  // Cross-references vessel positions with PRED layer GeoTIFF
  // Uses iceSampler.js to read pixel values at vessel coords
})

// GET /api/vessels/status
// Returns diagnostics: connection state, message count, vessel count
router.get("/status", async (req, res) => {
  // { status: "connected", vessels: 1234, messageCount: 56789, ... }
})
```

### GeoJSON Feature Properties

Each vessel feature in `/api/vessels/live` includes:

```json
{
  "type": "Feature",
  "geometry": { "type": "Point", "coordinates": [lon, lat] },
  "properties": {
    "mmsi": "257012340",
    "displayName": "EXAMPLE VESSEL",
    "shipName": "EXAMPLE VESSEL",
    "flag": "NO",
    "countryName": "Norway",
    "lat": 78.234,
    "lon": 15.567,
    "speed": 12.3,
    "course": 45.0,
    "heading": 47,
    "navStatus": "Under way using engine",
    "shipType": "Cargo",
    "shipTypeCode": 70,
    "draught": 8.5,
    "destination": "LONGYEARBYEN",
    "eta": "2026-06-01T14:00:00Z",
    "lastSeen": "2026-06-01T12:34:56Z",
    "ageHuman": "2m ago",
    "imo": "IMO1234567",
    "callsign": "LJEX"
  }
}
```

---

## Frontend Components

### Vector Layer Rendering

Vessels are rendered as a standard MMGIS **vector layer**:

**Layer Config Location:** `configs` table, `config` JSON column
```json
{
  "name": "Vessels (Live AIS)",
  "type": "vector",
  "url": "/api/vessels/live",
  "time": {
    "enabled": true,
    "endtime": "endtime",
    "timefield": "lastSeen",
    "format": "ISO 8601"
  },
  "style": {
    "useKeyAsName": "displayName",
    "radius": 6,
    "fillColor": "#00aaff",
    "color": "#ffffff",
    "weight": 1,
    "fillOpacity": 0.85
  },
  "initialwindowstart": "2026-05-04T20:00:00Z",
  "initialwindowend": "now"
}
```

**How Time Slider Works:**
1. User moves time slider to timestamp `T`
2. `LayerCapturer.js` replaces `{endtime}` token in URL → `/api/vessels/live?at=T`
3. Backend switches to **historical mode** (queries PostGIS)
4. Leaflet redraws markers at historical positions
5. `rebindVesselPopups()` re-attaches rich popups

### Rich Vessel Popups

**File:** `src/essence/Frozon-MMGIS-Plugin-Tools/AgentChat/renderers.js`

```javascript
function rebindVesselPopups() {
  // Idempotent — safe to call repeatedly
  // Runs every 2 seconds via setInterval
  
  const vesselLayer = L_.layers.layer['Vessels (Live AIS)']
  vesselLayer.eachLayer((marker) => {
    const props = marker.feature.properties
    const html = `
      <div class="vessel-popup">
        <h3>${props.displayName || props.mmsi}</h3>
        <table>
          <tr><td>MMSI:</td><td>${props.mmsi}</td></tr>
          <tr><td>Flag:</td><td>${props.countryName} (${props.flag})</td></tr>
          <tr><td>Speed:</td><td>${props.speed} kn</td></tr>
          <tr><td>Course:</td><td>${props.course}°</td></tr>
          <tr><td>Heading:</td><td>${props.heading}°</td></tr>
          <tr><td>Status:</td><td>${props.navStatus}</td></tr>
          <tr><td>Position:</td><td>${props.lat.toFixed(4)}, ${props.lon.toFixed(4)}</td></tr>
          <tr><td>Last seen:</td><td>${props.ageHuman}</td></tr>
        </table>
        <a href="https://www.marinetraffic.com/en/ais/details/ships/mmsi:${props.mmsi}" target="_blank">MarineTraffic</a>
        <a href="https://www.vesselfinder.com/?mmsi=${props.mmsi}" target="_blank">VesselFinder</a>
      </div>
    `
    marker.bindPopup(html)
  })
}

// Auto-rebind on layer toggle, time slider change, and every 2 seconds
setInterval(rebindVesselPopups, 2000)
L_.subscribeOnLayerToggle('vesselPopups', (name, off) => {
  if (name === 'Vessels (Live AIS)' && !off) setTimeout(rebindVesselPopups, 200)
})
L_.subscribeTimeLayerReloadFinish('vesselPopups', () => {
  setTimeout(rebindVesselPopups, 100)
})
```

**Why Periodic Rebind?**
- MMGIS auto-refreshes vector layers every 30 sec
- Time slider changes trigger layer reload
- Both operations create new Leaflet markers **without** popups
- Periodic `rebindVesselPopups()` ensures popups are always attached

### Vessel Track Drawing

**Click on any vessel marker → automatically draws track:**

```javascript
function installVesselClickTrackHandler() {
  map.on('click', async (e) => {
    const layer = e.layer
    if (layer?.feature?.properties?.mmsi) {
      const mmsi = layer.feature.properties.mmsi
      const resp = await fetch(`/api/vessels/track?mmsi=${mmsi}`)
      const geojson = await resp.json()
      
      // Draw LineString on map
      const trackLayer = L.geoJSON(geojson, {
        style: { color: '#ff6600', weight: 2, opacity: 0.8 }
      })
      trackLayer.addTo(map)
      
      // Auto-remove after 30 sec
      setTimeout(() => trackLayer.remove(), 30000)
    }
  })
}
```

### Copilot Chat Tools

**File:** `src/essence/Frozon-MMGIS-Plugin-Tools/AgentChat/renderers.js`

Three vessel-related tools for the AI Copilot:

#### 1. **show_vessels_in_area**
```javascript
// Adds vessel layer with bbox filter
render_show_vessels_in_area(action) {
  const { bounds, types, flags } = action.args
  const qs = new URLSearchParams()
  if (bounds) qs.append('bounds', bounds.join(','))
  if (types) qs.append('types', types.join(','))
  if (flags) qs.append('flags', flags.join(','))
  
  // Add layer to map
  LayersTool.addCustomLayer({
    name: 'Vessels (filtered)',
    url: `/api/vessels/live?${qs}`,
    type: 'vector'
  })
}
```

#### 2. **get_vessel_track**
```javascript
// Fetches and draws historical track for one vessel
render_get_vessel_track(action) {
  const { mmsi } = action.args
  fetch(`/api/vessels/track?mmsi=${mmsi}`)
    .then(r => r.json())
    .then(geojson => {
      L.geoJSON(geojson, { color: '#ff6600' }).addTo(map)
    })
}
```

#### 3. **vessel_ice_crossings**
```javascript
// Cross-references vessels with ice layer
render_vessel_ice_crossings(action) {
  fetch('/api/vessels/in-ice')
    .then(r => r.json())
    .then(vessels => {
      // Highlight vessels in ice
      vessels.features.forEach(v => {
        const marker = L.circleMarker([v.geometry.coordinates[1], v.geometry.coordinates[0]], {
          color: 'red',
          fillColor: 'red',
          radius: 8
        }).addTo(map)
      })
    })
}
```

---

## Data Flow

### Live Mode (Default)

```
1. Browser opens mission → MMGIS loads layer config
2. LayersTool requests /api/vessels/live (no ?at parameter)
3. Backend returns in-memory cache (last position per MMSI)
4. Leaflet renders markers
5. rebindVesselPopups() attaches popups (every 2 sec)
6. Auto-refresh every 30 sec (configured in layer.time.refreshIntervalAmount)
```

### Historical Mode (Time Slider Active)

```
1. User moves time slider to 2026-05-04T18:00:00Z
2. LayerCapturer.js replaces {endtime} → /api/vessels/live?at=2026-05-04T18:00:00Z
3. Backend queries vessel_positions table:
   SELECT DISTINCT ON (mmsi) * FROM vessel_positions
   WHERE t_utc <= '2026-05-04T18:00:00Z'
   ORDER BY mmsi, t_utc DESC
4. Returns GeoJSON with _meta.mode = "historical"
5. Leaflet redraws markers at historical positions
6. rebindVesselPopups() re-attaches popups
```

### Track Drawing (Click Handler)

```
1. User clicks vessel marker
2. Click handler extracts mmsi from marker.feature.properties
3. Fetch /api/vessels/track?mmsi=257012340
4. Backend queries vessel_positions:
   SELECT * FROM vessel_positions
   WHERE mmsi = '257012340'
   ORDER BY t_utc DESC
   LIMIT 200
5. Returns GeoJSON LineString
6. Draw LineString on map with orange color
7. Auto-remove after 30 sec
```

---

## API Endpoints

### **GET /api/vessels/live**

Returns live or historical vessel positions as GeoJSON FeatureCollection.

**Query Parameters:**
- `bounds` (optional) — `minLon,minLat,maxLon,maxLat` bbox filter
- `types` (optional) — Comma-separated vessel types (e.g., `Cargo,Tanker`)
- `flags` (optional) — Comma-separated ISO2 country codes (e.g., `NO,RU,US`)
- `at` (optional) — ISO8601 timestamp for historical mode (e.g., `2026-05-04T18:00:00Z`)
- `windowMinutes` (optional) — Look-back window for historical query (default 60)

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [15.567, 78.234] },
      "properties": {
        "mmsi": "257012340",
        "displayName": "EXAMPLE VESSEL",
        "flag": "NO",
        "speed": 12.3,
        "course": 45.0,
        "lastSeen": "2026-06-01T12:34:56Z"
      }
    }
  ],
  "_meta": {
    "mode": "live",  // or "historical" or "live-fallback"
    "count": 1234
  }
}
```

### **GET /api/vessels/track?mmsi=257012340**

Returns historical track for one vessel as GeoJSON LineString.

**Response:**
```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [15.567, 78.234],
      [15.568, 78.235],
      [15.569, 78.236]
    ]
  },
  "properties": {
    "mmsi": "257012340",
    "shipName": "EXAMPLE VESSEL",
    "pointCount": 3
  }
}
```

### **GET /api/vessels/in-ice**

Returns vessels currently in ≥15% ice concentration.

**Response:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [15.567, 78.234] },
      "properties": {
        "mmsi": "257012340",
        "displayName": "EXAMPLE VESSEL",
        "iceConcentration": 45.5
      }
    }
  ]
}
```

### **GET /api/vessels/status**

Returns WebSocket connection diagnostics.

**Response:**
```json
{
  "status": "connected",
  "vessels": 1234,
  "messageCount": 56789,
  "connectedAt": "2026-06-01T10:00:00Z",
  "lastMessageAt": "2026-06-01T12:34:56Z",
  "lastError": null
}
```

---

## Environment Configuration

All configuration is in `.env` file:

```bash
# Enable vessels plugin
WITH_VESSELS=true

# AISStream.io API key (required) — https://aisstream.io
AISSTREAM_API_KEY=your-api-key-here

# Bounding box subscription (optional)
# Default: Arctic only [[[60, -180], [90, 180]]]
# Format: JSON array of [[lat,lon],[lat,lon]] boxes (lat,lon NOT lon,lat!)
AISSTREAM_BBOX=[[[60,-180],[90,180]]]

# In-memory cache TTL (optional, default 60 minutes)
AISSTREAM_TTL_MINUTES=60

# PostGIS history retention (optional, default 7 days)
# Set to 0 to disable persistence
VESSEL_HISTORY_DAYS=7
```

**Important Notes:**
- **Free tier:** AISStream.io offers a free API key with global coverage
- **Bbox format:** `[[lat,lon],[lat,lon]]` (lat first, NOT lon first!)
- **Arctic default:** `[[[60, -180], [90, 180]]]` covers all latitudes ≥60°N
- **Global coverage:** Use `[[[-90, -180], [90, 180]]]` for entire world

---

## Database Schema

### **vessel_positions** Table

```sql
CREATE TABLE vessel_positions (
  id BIGSERIAL PRIMARY KEY,
  mmsi VARCHAR(15) NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  speed REAL,
  course REAL,
  t_utc TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vessel_positions_mmsi_t_utc
  ON vessel_positions (mmsi, t_utc DESC);
```

**Fields:**
- `mmsi` — Maritime Mobile Service Identity (9-digit unique vessel ID)
- `lon`, `lat` — Position in WGS84 decimal degrees
- `speed` — Speed over ground in knots
- `course` — Course over ground in degrees (0–360)
- `t_utc` — Position timestamp (from AIS message)

**Retention:**
- Default: 7 days rolling window
- Cleanup runs every 30 minutes (in `setup.js`)
- Configurable via `VESSEL_HISTORY_DAYS` env var

**Write Throttling:**
- Max 1 row per MMSI per 60 seconds
- Prevents DB bloat in busy ports
- Implemented in `aisstreamClient.js` `_flushPersistQueue()`

---

## Layer Configuration

### How to Add Vessel Layer to Mission

**Option 1: SQL Insert (recommended)**

```sql
-- Insert new config version with vessels layer
INSERT INTO configs (mission, version, config)
SELECT 
  'frozon_ai_forecast',
  COALESCE(MAX(version), 0) + 1,
  jsonb_set(
    config::jsonb,
    '{layers,0,sublayers}',
    (config::jsonb->'layers'->0->'sublayers') || '[
      {
        "name": "Vessels (Live AIS)",
        "type": "vector",
        "url": "http://localhost:8888/api/vessels/live",
        "time": {
          "enabled": true,
          "endtime": "endtime",
          "timefield": "lastSeen",
          "format": "ISO 8601",
          "refreshIntervalEnabled": true,
          "refreshIntervalAmount": 30
        },
        "style": {
          "useKeyAsName": "displayName",
          "radius": 6,
          "fillColor": "#00aaff",
          "color": "#ffffff",
          "weight": 1,
          "fillOpacity": 0.85
        },
        "initialwindowstart": "2026-05-04T20:00:00Z",
        "initialwindowend": "now"
      }
    ]'::jsonb
  )
FROM configs
WHERE mission = 'frozon_ai_forecast';
```

**Option 2: Configure Page (GUI)**

1. Open `/configure` page
2. Navigate to mission `frozon_ai_forecast`
3. Go to Layers tab
4. Add new vector layer:
   - Name: `Vessels (Live AIS)`
   - Type: `vector`
   - URL: `/api/vessels/live`
   - Enable time control
   - Set refresh interval: 30 seconds
5. Save new config version

---

## Key Insights & Design Decisions

### Why WebSocket in Backend, Not Frontend?

❌ **Frontend WebSocket (rejected):**
- Would expose API key in browser
- One upstream connection per visitor
- Rate limit issues
- Can't persist to PostGIS from browser

✅ **Backend WebSocket (chosen):**
- API key stays server-side
- Single shared connection for all users
- Efficient caching + bbox filtering
- Easy persistence to PostGIS

### Why In-Memory Cache + PostGIS?

- **In-memory cache:** Ultra-fast live queries (< 1 ms)
- **PostGIS persistence:** Historical replay + track drawing
- **Write throttling:** Prevents DB bloat (1 row/MMSI/min)
- **TTL eviction:** Auto-cleanup of stale vessels

### Why Periodic `rebindVesselPopups()`?

MMGIS auto-refreshes vector layers, which **destroys and recreates** all Leaflet markers. New markers have no popups until `rebindVesselPopups()` runs again. A 2-second interval ensures popups are always available within seconds of layer refresh.

### Historical Mode vs Live Mode

| Mode | Trigger | Data Source | Cache |
|------|---------|-------------|-------|
| **Live** | No `?at` param | In-memory cache | 15 sec |
| **Historical** | `?at=<timestamp>` | PostGIS query | 60 sec |
| **Live Fallback** | `?at=<old_date>` + empty result | In-memory cache | 15 sec |

**Live Fallback** prevents the layer from appearing mysteriously blank when time slider is moved to a date outside the 7-day retention window.

---

## Related Documentation

- **Deployment Guide:** `DEPLOYMENT-GUIDE.md`
- **Integration Docs:** `docs/vessel-tracking-integration.md`
- **API Evaluation:** `ais-api-evaluation.md`
- **Plugin README:** `API/Frozon-MMGIS-Plugin-Backend/Vessels/README.md`
- **Quick Start:** `quick-start-ais-integration.md`

---

## Summary

✅ **Real-time AIS tracking** via AISStream.io WebSocket  
✅ **Backend plugin** with in-memory cache + PostGIS persistence  
✅ **REST API** for live positions, historical replay, tracks  
✅ **Frontend integration** via MMGIS vector layer + time slider  
✅ **Rich popups** with vessel metadata + external links  
✅ **Copilot tools** for AI-assisted vessel queries  
✅ **7-day rolling history** for track visualization  

**Key Files to Review:**
1. `API/Frozon-MMGIS-Plugin-Backend/Vessels/aisstreamClient.js` — WebSocket client
2. `API/Frozon-MMGIS-Plugin-Backend/Vessels/routes/vessels.js` — REST API
3. `src/essence/Frozon-MMGIS-Plugin-Tools/AgentChat/renderers.js` — Frontend popups
4. `docs/vessel-tracking-integration.md` — Full integration docs
