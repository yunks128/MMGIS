# Arctic Ship Navigation Integration Plan

## Objective
Integrate real-time/historical ship navigation data with SFNO sea ice predictions to provide navigation route suggestions in the Arctic region.

## Phase 1: Data Visualization (Current Focus)

### Available Data Sources

#### 1. MarineTraffic API
- **Endpoint**: `https://services.marinetraffic.com/api/exportvessels/v:8/{API_KEY}/protocol:jsono`
- **Data**: Real-time vessel positions, tracks, vessel details
- **Coverage**: Arctic shipping routes
- **Cost**: Paid API (free tier available for testing)
- **Implementation**: Vector layer with vessel markers

#### 2. Norwegian Meteorological Institute
- **Ice Charts API**: `https://api.met.no/weatherapi/icecoverage/1.0/`
- **Free**: Yes
- **Coverage**: Norwegian Arctic, Barents Sea
- **Format**: GeoJSON

#### 3. Canadian Ice Service
- **Endpoint**: `https://ice-glaces.ec.gc.ca/IceGraph30/page1.jsf`
- **Data**: Ice concentration, navigation warnings
- **Format**: GeoJSON, WMS layers
- **Free**: Yes

#### 4. ArcticConnect (Open Data)
- **Source**: Historical Arctic shipping routes dataset
- **Format**: GeoJSON/Shapefile
- **URL**: Can be loaded as static vector layer

### Recommended Starting Point: Static Vector Layer

**Quick Win**: Load historical Arctic shipping routes as a vector layer

1. Download historical route data:
   - Northwest Passage routes
   - Northern Sea Route
   - Trans-Arctic routes

2. Convert to GeoJSON

3. Add as MMGIS vector layer:
```json
{
  "name": "Arctic Shipping Routes",
  "type": "vector",
  "url": "Missions/frozon/Layers/arctic_shipping_routes.geojson",
  "visibility": true,
  "style": {
    "color": "#00FFFF",
    "weight": 3
  }
}
```

## Phase 2: Real-Time AIS Integration

### Backend API Proxy
Create MMGIS backend endpoint to proxy AIS data:

**File**: `API/Backend/APIs/ArcticNavigation.js`

```javascript
// Proxy MarineTraffic or other AIS provider
router.get('/api/arctic/vessels', authenticate, async (req, res) => {
  const { bounds } = req.query; // [minLon, minLat, maxLon, maxLat]
  
  // Call external AIS API
  const vessels = await fetchAISData(bounds);
  
  // Transform to GeoJSON
  const geojson = {
    type: "FeatureCollection",
    features: vessels.map(v => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [v.lon, v.lat]
      },
      properties: {
        name: v.shipName,
        speed: v.speed,
        course: v.course,
        type: v.vesselType,
        destination: v.destination,
        lastUpdate: v.timestamp
      }
    }))
  };
  
  res.json(geojson);
});
```

### Frontend Dynamic Layer
Update vessels every 5 minutes using MMGIS dynamic vector layer.

## Phase 3: Navigation Suggestion Algorithm

### Backend Route Optimization Service

**File**: `API/Backend/APIs/NavigationSuggestions.js`

#### Algorithm Overview:
1. **Input**:
   - Start position (lat, lon)
   - Destination (lat, lon)
   - Vessel ice class (A, B, C, none)
   - Date range

2. **Process**:
   - Query SFNO prediction layers for ice concentration along potential routes
   - Apply ice class thresholds:
     - Ice Class A: Can navigate through ice up to 80% concentration
     - Ice Class B: Safe up to 50% concentration
     - Ice Class C: Safe up to 30% concentration
     - No ice class: Avoid areas >15% concentration
   
   - Use pathfinding (A* or Dijkstra) with cost function:
     ```
     cost = distance + (ice_penalty * ice_concentration)
     ```
   
   - Generate 2-3 alternative routes

3. **Output**:
   - GeoJSON LineString routes
   - Risk assessment per segment
   - Estimated transit time
   - Ice concentration warnings

#### Example API:
```javascript
POST /api/arctic/suggest-route
{
  "start": [-150.0, 70.5],
  "end": [-130.0, 72.0],
  "iceClass": "B",
  "dateRange": ["2024-01-15", "2024-01-22"]
}

Response:
{
  "routes": [
    {
      "id": 1,
      "type": "recommended",
      "geometry": {...},
      "distance_km": 450,
      "max_ice_concentration": 45,
      "avg_ice_concentration": 25,
      "risk_level": "moderate",
      "segments": [
        {
          "start_km": 0,
          "end_km": 150,
          "ice_concentration": 20,
          "warning": null
        },
        {
          "start_km": 150,
          "end_km": 300,
          "ice_concentration": 45,
          "warning": "Elevated ice concentration - monitor conditions"
        }
      ]
    }
  ]
}
```

## Phase 4: MMGIS Copilot Integration

Add navigation suggestion tools to the Agent Copilot:

### New Tools:

1. **`suggest_navigation_route`**
   - User: "Suggest a route from Point A to Point B avoiding heavy ice"
   - Agent calls backend route optimization
   - Renders route on map with color-coded risk segments

2. **`show_vessel_traffic`**
   - User: "Show current ships in this area"
   - Agent queries AIS proxy
   - Renders vessel markers with tooltips

3. **`ice_safety_assessment`**
   - User: "Is this route safe for ice class B vessels?"
   - Agent queries SFNO predictions along user-drawn route
   - Returns ice concentration profile and safety warnings

### Tool Registry Additions:
```json
{
  "name": "suggest_navigation_route",
  "description": "Suggests optimal ship navigation routes in Arctic waters based on ice predictions",
  "modelParameters": {
    "type": "object",
    "properties": {
      "start_lat": {"type": "number"},
      "start_lon": {"type": "number"},
      "end_lat": {"type": "number"},
      "end_lon": {"type": "number"},
      "ice_class": {"type": "string", "enum": ["A", "B", "C", "none"]},
      "departure_date": {"type": "string", "format": "date"}
    },
    "required": ["start_lat", "start_lon", "end_lat", "end_lon"]
  },
  "execution": {
    "backend": "/api/arctic/suggest-route",
    "ui": {
      "type": "navigation_route",
      "renderer": "render_navigation_route"
    }
  }
}
```

## Implementation Priority

### Week 1: Static Visualization
- [ ] Find and download historical Arctic shipping route dataset
- [ ] Convert to GeoJSON
- [ ] Add as vector layer in MMGIS config
- [ ] Test visualization with SFNO layers

### Week 2: Data API Research
- [ ] Evaluate MarineTraffic API (request trial key)
- [ ] Test Norwegian Met API for ice data
- [ ] Document data formats and update rates

### Week 3: Backend Proxy
- [ ] Create `/api/arctic/vessels` endpoint
- [ ] Implement AIS data caching (Redis or in-memory)
- [ ] Add authentication/rate limiting

### Week 4: Route Optimization
- [ ] Implement basic pathfinding algorithm
- [ ] Integrate SFNO raster sampling
- [ ] Create `/api/arctic/suggest-route` endpoint
- [ ] Test with known Arctic routes

### Week 5: Frontend Integration
- [ ] Add dynamic vessel layer to MMGIS
- [ ] Create route suggestion UI in Draw tool or dedicated panel
- [ ] Integrate with Copilot tools

## Data Considerations

### Ice Concentration Thresholds
Based on IMO Polar Code guidelines:
- **Open Water**: 0-10% ice
- **Very Open Pack Ice**: 10-30%
- **Open Pack Ice**: 30-50%
- **Close Pack Ice**: 50-70%
- **Very Close Pack Ice**: 70-90%
- **Compact/Consolidated Ice**: 90-100%

### Navigation Rules:
- Ice Class A (PC1-3): Can operate year-round in most Arctic waters
- Ice Class B (PC4-5): Summer/autumn operations in moderate ice
- Ice Class C (PC6-7): Light ice conditions only
- Non-ice strengthened: Open water routes only

## Technologies

### Backend:
- **Pathfinding**: `geojson-path-finder` npm package
- **Raster sampling**: `geotiff.js` for reading SFNO COGs
- **Caching**: Redis for AIS data (5-minute TTL)

### Frontend:
- **Route visualization**: Leaflet polylines with color gradients
- **Vessel markers**: Custom icons by vessel type
- **Animation**: Animate historical vessel tracks

## Example Use Cases

1. **"Show me the safest route from Prudhoe Bay to Resolute Bay for an ice class B vessel departing next week"**
   - System queries SFNO 7-day predictions
   - Calculates optimal route avoiding >50% concentration
   - Displays route with segment risk coloring

2. **"Are there any ships currently navigating through the Northwest Passage?"**
   - Queries AIS for vessels in NWP bounds
   - Displays real-time positions
   - Shows vessel details on click

3. **"Compare the predicted ice conditions along the Northern Sea Route between route A and route B"**
   - User draws two potential routes
   - System samples SFNO predictions along each
   - Shows ice concentration profiles

## Resources & References

- IMO Polar Code: https://www.imo.org/en/OurWork/Safety/Pages/polar-code.aspx
- Arctic Shipping Routes Map: https://www.arcticportal.org/
- NSIDC Sea Ice Index: https://nsidc.org/data/seaice_index/
- MarineTraffic API Docs: https://www.marinetraffic.com/en/ais-api-services/
- Canadian Ice Service: https://ice-glaces.ec.gc.ca/

## Next Steps

1. **Immediate**: Research and identify the best free/accessible Arctic AIS data source
2. **Prototype**: Create a simple static vector layer showing known Arctic routes
3. **Validate**: Confirm SFNO prediction accuracy against recent ice conditions
4. **Design**: Sketch UI mockups for route suggestion interface
