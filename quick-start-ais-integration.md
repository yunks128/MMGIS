# Quick Start: AIS Integration for MMGIS

## Step 1: Register for AISHub (Do This Today)

1. Go to https://www.aishub.net/register
2. Create account
3. Submit research access request with this text:

```
Subject: Research Access Request - NASA/JPL Arctic Navigation Project

Hello,

I'm working on the MMGIS (Multi-Mission Geographic Information System) project 
at NASA/JPL. We're developing an Arctic ship navigation system that combines 
AI-based sea ice concentration forecasts (SFNO model) with real-time vessel 
tracking to suggest safe navigation routes.

We would like to integrate AISHub's community data feed to visualize vessel 
positions in Arctic waters alongside our ice prediction layers. This is for 
research and educational purposes, not commercial use.

Project details:
- Open source: https://github.com/NASA-AMMOS/MMGIS
- Purpose: Arctic maritime safety and route optimization
- Expected usage: Real-time vessel positions for Arctic regions

Would you be able to grant us API access for this research application?

Thank you for considering this request.
```

4. Wait for approval (usually 1-3 days)

---

## Step 2: Add NOAA Vessel Traffic Layer (Do This Now)

While waiting for AISHub approval, add historical vessel traffic visualization:

### Edit Mission Config

Add this to your `frozon_ai_forecast` layers array:

```json
{
  "name": "Vessel Traffic Density",
  "uuid": "vessel-traffic-noaa-001",
  "sublayers": [],
  "type": "tile",
  "visibility": false,
  "sourceType": "url",
  "url": "https://coast.noaa.gov/arcgis/services/MarineCadastre/VesselTraffic/MapServer/WMSServer?SERVICE=WMS&REQUEST=GetMap&LAYERS=0&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&VERSION=1.1.1&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&BBOX={bbox-epsg-3857}",
  "tileformat": "wms",
  "controlled": false,
  "initialOpacity": 0.6,
  "minZoom": 0,
  "maxNativeZoom": 12,
  "maxZoom": 14,
  "throughTileServer": false,
  "style": {
    "brightness": 1,
    "contrast": 1,
    "saturation": 1,
    "blend": "multiply"
  },
  "time": {
    "enabled": false
  },
  "variables": {
    "legendOrientation": "horizontal"
  },
  "description": "Historical vessel traffic density in Arctic waters (NOAA Marine Cadastre)"
}
```

### Insert into Database

```sql
-- Update frozon_ai_forecast config
UPDATE configs 
SET config = jsonb_insert(
  config::jsonb, 
  '{layers, 2}',
  '{
    "name": "Vessel Traffic Density",
    "uuid": "vessel-traffic-noaa-001",
    "type": "tile",
    "visibility": false,
    "sourceType": "url",
    "url": "https://coast.noaa.gov/arcgis/services/MarineCadastre/VesselTraffic/MapServer/WMSServer?SERVICE=WMS&REQUEST=GetMap&LAYERS=0&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&VERSION=1.1.1&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&BBOX={bbox-epsg-3857}",
    "tileformat": "wms",
    "initialOpacity": 0.6,
    "maxNativeZoom": 12
  }'::jsonb
)
WHERE mission='frozon_ai_forecast' AND version=39;
```

Or use MMGIS Configure page to add it manually.

---

## Step 3: Backend API for Live Vessels (Once AISHub Approved)

### Create Backend Route

**File**: `API/Frozon-MMGIS-Plugin-Backend/VesselTracking/routes.js`

```javascript
const express = require('express');
const router = express.Router();
const axios = require('axios');

// Environment variables
const AISHUB_USER = process.env.AISHUB_USERNAME;
const AISHUB_FORMAT = '1'; // Simple format

/**
 * GET /api/vessels/live
 * Returns live vessel positions in GeoJSON format
 * 
 * Query params:
 *   bounds: [minLon,minLat,maxLon,maxLat]
 */
router.get('/live', async (req, res) => {
  try {
    const { bounds } = req.query;
    
    if (!bounds) {
      return res.status(400).json({ error: 'bounds parameter required' });
    }
    
    const [minLon, minLat, maxLon, maxLat] = bounds.split(',').map(Number);
    
    // Validate bounds
    if ([minLon, minLat, maxLon, maxLat].some(n => isNaN(n))) {
      return res.status(400).json({ error: 'Invalid bounds format' });
    }
    
    // Call AISHub API
    const response = await axios.get('http://data.aishub.net/ws.php', {
      params: {
        username: AISHUB_USER,
        format: AISHUB_FORMAT,
        output: 'json',
        compress: 0,
        latmin: minLat,
        latmax: maxLat,
        lonmin: minLon,
        lonmax: maxLon
      },
      timeout: 10000
    });
    
    // Transform to GeoJSON
    const vessels = Array.isArray(response.data) ? response.data : [response.data];
    
    const geojson = {
      type: 'FeatureCollection',
      features: vessels
        .filter(v => v && v.MMSI && v.LAT && v.LON)
        .map(vessel => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [vessel.LON, vessel.LAT]
          },
          properties: {
            mmsi: vessel.MMSI,
            name: vessel.NAME || 'Unknown',
            callsign: vessel.CALLSIGN || '',
            imo: vessel.IMO || null,
            speed: vessel.SPEED || 0,
            course: vessel.COURSE || 0,
            heading: vessel.HEADING || 0,
            navstat: vessel.NAVSTAT || 15,
            destination: vessel.DEST || '',
            eta: vessel.ETA || '',
            vesselType: vessel.TYPE || 0,
            vesselTypeText: getVesselTypeText(vessel.TYPE),
            lastUpdate: new Date().toISOString(),
            dimensions: {
              a: vessel.A || 0,
              b: vessel.B || 0,
              c: vessel.C || 0,
              d: vessel.D || 0,
              length: (vessel.A || 0) + (vessel.B || 0),
              width: (vessel.C || 0) + (vessel.D || 0)
            },
            draught: vessel.DRAUGHT || 0
          }
        }))
    };
    
    // Cache for 5 minutes
    res.set('Cache-Control', 'public, max-age=300');
    res.json(geojson);
    
  } catch (error) {
    console.error('Error fetching vessel data:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch vessel data',
      details: error.message 
    });
  }
});

/**
 * Convert AIS vessel type code to human-readable text
 */
function getVesselTypeText(typeCode) {
  const types = {
    20: 'Wing in ground',
    30: 'Fishing',
    31: 'Towing',
    32: 'Towing (large)',
    33: 'Dredging',
    34: 'Diving',
    35: 'Military',
    36: 'Sailing',
    37: 'Pleasure craft',
    50: 'Pilot vessel',
    51: 'Search and rescue',
    52: 'Tug',
    53: 'Port tender',
    54: 'Anti-pollution',
    55: 'Law enforcement',
    58: 'Medical',
    60: 'Passenger',
    70: 'Cargo',
    80: 'Tanker',
    90: 'Other'
  };
  
  // Type codes are ranges (e.g., 60-69 are all passenger)
  const baseType = Math.floor(typeCode / 10) * 10;
  return types[baseType] || 'Unknown';
}

module.exports = router;
```

### Register Route in Backend

**File**: `API/Frozon-MMGIS-Plugin-Backend/setup.js`

Add this route registration:

```javascript
const vesselRoutes = require('./VesselTracking/routes');
app.use('/api/vessels', vesselRoutes);
```

### Add Environment Variable

In `.env`:
```bash
AISHUB_USERNAME=your_username_here
```

---

## Step 4: Frontend Dynamic Vessel Layer

### Create Vessel Layer Manager

**File**: `src/essence/Frozon-MMGIS-Plugin-Tools/VesselTracking/VesselLayer.js`

```javascript
import L from 'leaflet';
import $ from 'jquery';

const VesselLayer = {
  map: null,
  layerGroup: null,
  updateInterval: null,
  
  init(map) {
    this.map = map;
    this.layerGroup = L.layerGroup().addTo(map);
    this.startAutoUpdate();
  },
  
  async updateVessels() {
    try {
      const bounds = this.map.getBounds();
      const boundsArray = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ];
      
      const response = await $.ajax({
        url: '/api/vessels/live',
        method: 'GET',
        data: {
          bounds: boundsArray.join(',')
        }
      });
      
      this.renderVessels(response);
      
    } catch (error) {
      console.error('Failed to update vessels:', error);
    }
  },
  
  renderVessels(geojson) {
    // Clear existing vessels
    this.layerGroup.clearLayers();
    
    if (!geojson || !geojson.features) return;
    
    geojson.features.forEach(feature => {
      const { coordinates } = feature.geometry;
      const props = feature.properties;
      
      // Create vessel icon based on type
      const icon = this.getVesselIcon(props.vesselType, props.course);
      
      const marker = L.marker([coordinates[1], coordinates[0]], {
        icon: icon,
        rotationAngle: props.course || 0
      });
      
      // Create popup
      const popup = this.createVesselPopup(props);
      marker.bindPopup(popup);
      
      marker.addTo(this.layerGroup);
    });
  },
  
  getVesselIcon(vesselType, course) {
    // Simple colored circle for now
    // TODO: Use ship-shaped icons rotated by course
    const colors = {
      30: '#FF6B6B', // Fishing - red
      60: '#4ECDC4', // Passenger - cyan
      70: '#95E1D3', // Cargo - green
      80: '#F38181', // Tanker - pink
      default: '#FFFFFF' // Unknown - white
    };
    
    const baseType = Math.floor(vesselType / 10) * 10;
    const color = colors[baseType] || colors.default;
    
    return L.divIcon({
      html: `<div style="
        width: 12px;
        height: 12px;
        background: ${color};
        border: 2px solid #000;
        border-radius: 50%;
        transform: rotate(${course}deg);
      "></div>`,
      className: 'vessel-marker',
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });
  },
  
  createVesselPopup(props) {
    return `
      <div class="vessel-popup">
        <h4>${props.name}</h4>
        <table>
          <tr><td><b>Type:</b></td><td>${props.vesselTypeText}</td></tr>
          <tr><td><b>MMSI:</b></td><td>${props.mmsi}</td></tr>
          <tr><td><b>Speed:</b></td><td>${props.speed.toFixed(1)} knots</td></tr>
          <tr><td><b>Course:</b></td><td>${props.course}°</td></tr>
          <tr><td><b>Destination:</b></td><td>${props.destination || 'N/A'}</td></tr>
          ${props.eta ? `<tr><td><b>ETA:</b></td><td>${props.eta}</td></tr>` : ''}
        </table>
      </div>
    `;
  },
  
  startAutoUpdate() {
    // Update vessels every 5 minutes
    this.updateVessels();
    this.updateInterval = setInterval(() => {
      this.updateVessels();
    }, 5 * 60 * 1000);
  },
  
  stopAutoUpdate() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  },
  
  destroy() {
    this.stopAutoUpdate();
    if (this.layerGroup) {
      this.layerGroup.clearLayers();
      this.layerGroup.remove();
    }
  }
};

export default VesselLayer;
```

### Initialize in Map

**File**: `src/essence/Basics/Map_/Map_.js`

Add after map initialization:

```javascript
import VesselLayer from '../../Frozon-MMGIS-Plugin-Tools/VesselTracking/VesselLayer';

// After Leaflet map is created:
if (window.mmgisAPI && window.mmgisAPI.mission === 'frozon_ai_forecast') {
  VesselLayer.init(Map_.map);
}
```

---

## Step 5: Test the Integration

### 1. Add Environment Variable
```bash
echo "AISHUB_USERNAME=your_approved_username" >> .env
```

### 2. Rebuild and Deploy
```bash
npm run build
docker cp build/. mmgis-mmgis-1:/usr/src/app/build/
docker restart mmgis-mmgis-1
```

### 3. Test Backend API
```bash
# Test vessel API (after AISHub approval)
curl "http://localhost:8889/api/vessels/live?bounds=-180,65,180,90"
```

### 4. View in Browser
1. Open http://localhost:8889/?mission=frozon_ai_forecast
2. Enable "Vessel Traffic Density" layer to see historical patterns
3. Live vessels should appear as colored circles (once AISHub approved)
4. Click vessel markers to see details

---

## Step 6: Add Copilot Integration

### Add Vessel Tracking Tools

**File**: `API/Frozon-MMGIS-Plugin-Backend/Agent/tools/show_vessels.json`

```json
{
  "name": "show_vessels",
  "description": "Display live vessel positions in the current map view or specified area",
  "modelParameters": {
    "type": "object",
    "properties": {
      "area": {
        "type": "string",
        "description": "Geographic area (e.g., 'Beaufort Sea', 'Northwest Passage', 'current view')"
      }
    }
  },
  "execution": {
    "backend": null,
    "ui": {
      "type": "show_vessels",
      "description": "Enables live vessel tracking layer and refreshes data"
    }
  }
}
```

Register in `tool-registry.json` and add renderer in AgentChat tool.

---

## Timeline

| Day | Task | Status |
|-----|------|--------|
| Day 1 | Register AISHub | ⏳ Waiting approval |
| Day 1 | Add NOAA WMS layer | ✅ Ready to implement |
| Day 2-3 | Create backend vessel API | ⏳ Waiting for AISHub key |
| Day 4-5 | Frontend vessel layer | ⏳ After backend ready |
| Day 6 | Testing & debugging | ⏳ |
| Day 7 | Copilot integration | ⏳ |

---

## Expected Result

After completion, you'll have:

1. ✅ Historical vessel traffic density (NOAA) showing common Arctic routes
2. ✅ Live vessel positions updated every 5 minutes (AISHub)
3. ✅ Vessel details on click (name, type, speed, destination)
4. ✅ Color-coded vessels by type (cargo, tanker, passenger, etc.)
5. ✅ Backend caching to reduce API calls
6. ✅ Foundation for route optimization with SFNO ice predictions

---

## Next Enhancement: Route Suggestions

Once vessel tracking is working, the next step is combining it with SFNO ice predictions:

```
User: "Suggest a safe route for an ice class B cargo vessel from 
      Point Barrow to Resolute Bay departing next week"

MMGIS Copilot:
1. Queries SFNO 7-day ice predictions
2. Applies ice class B threshold (<50% concentration)
3. Calculates optimal route avoiding heavy ice
4. Shows route on map with color-coded risk segments
5. Displays current vessels navigating similar routes
```

This combines:
- SFNO ice forecasts
- Live vessel positions
- Historical traffic patterns
- Ice class safety thresholds

---

## Support

- AISHub support: http://www.aishub.net/contact
- NOAA Marine Cadastre: marinecadastre@noaa.gov
- MMGIS documentation: https://nasa-ammos.github.io/MMGIS/
