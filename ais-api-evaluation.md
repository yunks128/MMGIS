# AIS API Evaluation for Arctic Ship Navigation

## Executive Summary

After researching available AIS (Automatic Identification System) data sources, here are the most viable options for integrating real-time vessel tracking into MMGIS for Arctic navigation:

**Recommended Approach**: Hybrid strategy combining **AISHub (free community data)** for real-time positions with **NOAA Marine Cadastre (free historical data)** for traffic patterns.

---

## Evaluated AIS Data Providers

### 1. MarineTraffic (Now Kpler Maritime) ⭐⭐⭐⭐
**Status**: Commercial API - Requires subscription
**URL**: https://www.kpler.com/product/maritime/data-services (acquired MarineTraffic)
**Arctic Coverage**: Excellent (global coverage including Arctic routes)

**API Endpoint Structure**:
```
https://services.marinetraffic.com/api/exportvessels/v:8/{API_KEY}/protocol:jsono
```

**Pricing**:
- Starter: $50-100/month (limited queries)
- Professional: $500+/month (commercial use)
- Enterprise: Custom pricing

**Features**:
- ✅ Real-time vessel positions (updated every 1-3 minutes)
- ✅ Historical track data
- ✅ Vessel details (name, type, speed, course, destination)
- ✅ Geofencing and event notifications
- ✅ JSON/XML response formats
- ✅ Port call data

**Pros**:
- Most comprehensive global coverage
- High update frequency
- Excellent API documentation
- Reliable service with SLA

**Cons**:
- Expensive for non-commercial/research use
- Requires paid subscription (no free tier)
- Rate limits on cheaper plans

**Arctic Suitability**: 9/10 - Best commercial option if budget allows

---

### 2. AISHub ⭐⭐⭐⭐⭐
**Status**: Free - Community-driven (requires contributing station or data)
**URL**: https://www.aishub.net
**Arctic Coverage**: Good (depends on community coverage)

**Access Model**: 
- Share your AIS receiver data → get access to aggregated feed
- Alternative: Request research/non-profit access

**API Features**:
```
http://data.aishub.net/ws.php?username={USER}&format=1&output=json
```

**Parameters**:
- `format=1` - Simple position format
- `output=json` - JSON response
- `compress=0` - Uncompressed data
- Bounding box filtering available

**Coverage Statistics**:
- 86,599+ vessels tracked
- 1,495+ AIS receiver stations
- 80+ countries
- Arctic coverage: Moderate (depends on station locations)

**Data Format**:
```json
[
  {
    "MMSI": 219018938,
    "LAT": 55.2345,
    "LON": 12.6789,
    "SPEED": 8.5,
    "COURSE": 245,
    "HEADING": 248,
    "NAVSTAT": 0,
    "IMO": 9123456,
    "NAME": "VESSEL NAME",
    "CALLSIGN": "OY1234",
    "TYPE": 70,
    "A": 25,
    "B": 35,
    "C": 8,
    "D": 8,
    "DRAUGHT": 4.5,
    "DEST": "PORT NAME",
    "ETA": "12-25 14:30"
  }
]
```

**Pros**:
- ✅ FREE access (with contribution or approval)
- ✅ Real-time data
- ✅ Multiple output formats (JSON, XML, CSV)
- ✅ Community-driven (no vendor lock-in)
- ✅ Suitable for research/education

**Cons**:
- ⚠️ Coverage gaps in remote Arctic regions
- ⚠️ Update frequency varies by area
- ⚠️ Requires registration and approval
- ⚠️ No SLA or guaranteed uptime

**Arctic Suitability**: 7/10 - Best free option, good for prototype

**Implementation Steps**:
1. Register at aishub.net
2. Request research/education access (mention NASA/JPL MMGIS project)
3. If approved, use API endpoint with credentials
4. Cache data in MMGIS backend to reduce API calls

---

### 3. NOAA Marine Cadastre ⭐⭐⭐⭐
**Status**: Free - U.S. Government Open Data
**URL**: https://hub.marinecadastre.gov/pages/vesseltraffic
**Arctic Coverage**: Excellent for U.S. Arctic waters (Alaska)

**Data Type**: Historical AIS data (not real-time)

**Access Methods**:
1. **Downloadable Datasets**: 
   - Monthly AIS data by region
   - GeoDatabase format (.gdb)
   - Coverage: U.S. waters including Alaska Arctic

2. **ArcGIS REST API**:
   ```
   https://coast.noaa.gov/arcgis/rest/services/MarineCadastre/VesselTraffic/MapServer
   ```

3. **WMS Service** (for direct MMGIS integration):
   ```
   https://coast.noaa.gov/arcgis/services/MarineCadastre/VesselTraffic/MapServer/WMSServer
   ```

**Features**:
- ✅ Completely free
- ✅ High data quality (official NOAA data)
- ✅ Historical analysis (2009-present)
- ✅ Vessel density maps
- ✅ Track data
- ✅ Can be integrated as MMGIS tile layer

**Pros**:
- Free and unlimited access
- Official government source
- Excellent U.S. Arctic coverage (Northwest Passage, Beaufort Sea)
- Can visualize historical shipping patterns

**Cons**:
- ❌ NOT real-time (monthly updates)
- ⚠️ Limited coverage outside U.S. waters
- ⚠️ Large dataset downloads

**Arctic Suitability**: 8/10 - Excellent for historical analysis and U.S. Arctic routes

**MMGIS Integration**:
Add as WMS tile layer:
```json
{
  "name": "Vessel Traffic Density (NOAA)",
  "type": "tile",
  "sourceType": "url",
  "url": "https://coast.noaa.gov/arcgis/services/MarineCadastre/VesselTraffic/MapServer/WMSServer?SERVICE=WMS&REQUEST=GetMap&LAYERS=0&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&VERSION=1.1.1&WIDTH=256&HEIGHT=256&SRS=EPSG:3857&BBOX={bbox-epsg-3857}",
  "tileformat": "wms",
  "visibility": false,
  "initialOpacity": 0.7
}
```

---

### 4. Barentswatch (Norwegian) ⭐⭐⭐
**Status**: Free - Norwegian Government
**URL**: https://www.barentswatch.no
**Arctic Coverage**: Excellent for Norwegian Arctic (Barents Sea, Svalbard)

**Service**: NAIS (Norwegian AIS)
- Real-time vessel positions in Norwegian waters
- Covers important Arctic shipping routes
- API available with registration

**API Endpoint** (requires OAuth2):
```
https://www.barentswatch.no/bwapi/v1/geodata/ais/openpositions
```

**Authentication**: 
- Register for API access at barentswatch.no
- OAuth2 client credentials flow
- Free for research/non-commercial use

**Coverage Area**:
- Norwegian Sea
- Barents Sea
- Svalbard region
- Northern Sea Route (western section)

**Pros**:
- ✅ Free for research
- ✅ Real-time data
- ✅ Official government source
- ✅ Excellent coverage in key Arctic area

**Cons**:
- ⚠️ Limited to Norwegian territorial waters
- ⚠️ OAuth2 setup complexity
- ⚠️ Documentation primarily in Norwegian

**Arctic Suitability**: 8/10 - Excellent for Barents Sea/Svalbard region

---

### 5. VesselFinder ⭐⭐⭐
**Status**: Commercial API with limited free tier
**URL**: https://www.vesselfinder.com/api
**Arctic Coverage**: Good

**API Tiers**:
- Free: 50 requests/day
- Basic: $9/month (500 requests/day)
- Premium: $99/month (5000+ requests/day)

**Endpoint**:
```
https://api.vesselfinder.com/vesselslist?userkey={KEY}&latitude={LAT}&longitude={LON}&range={KM}
```

**Features**:
- Vessel search by area
- Position updates
- Photo library
- Port information

**Pros**:
- Limited free tier available
- Simple REST API
- Good documentation

**Cons**:
- Low free tier limits
- Real-time updates require premium

**Arctic Suitability**: 6/10 - Limited by free tier restrictions

---

### 6. Open-Source Solutions

#### pyAIS + RTL-SDR (DIY Approach)
**Status**: Free - Requires hardware
**Arctic Coverage**: Only if you have local AIS receiver

**Components**:
- RTL-SDR dongle ($25-40)
- AIS antenna
- pyAIS Python library for decoding
- AIS-catcher software

**Use Case**: 
- Deploy AIS receiver near Arctic operations
- Feed data to AISHub in exchange for global access
- Local coverage only

**Pros**:
- ✅ Complete control
- ✅ Can contribute to AISHub for global access
- ✅ Low cost

**Cons**:
- ❌ Requires physical hardware deployment
- ❌ Limited range (20-40 nautical miles)
- ❌ Not practical for global Arctic coverage

**Arctic Suitability**: 3/10 - Only for specific local deployments

---

## Recommended Implementation Strategy

### Phase 1: Prototype with Free Data (Week 1-2)

**Approach**: Combine AISHub + NOAA Marine Cadastre

1. **Register for AISHub access**
   - Submit research access request
   - Explain MMGIS Arctic navigation project
   - Goal: Real-time vessel positions

2. **Add NOAA WMS layer to MMGIS**
   - Immediate visual feedback
   - Shows historical traffic patterns
   - Identifies common Arctic routes

3. **Backend proxy for AISHub**
   ```javascript
   // API/Backend/APIs/ArcticNavigation.js
   router.get('/api/arctic/vessels/live', async (req, res) => {
     const { bounds } = req.query; // [minLon, minLat, maxLon, maxLat]
     
     // Call AISHub API
     const response = await axios.get('http://data.aishub.net/ws.php', {
       params: {
         username: process.env.AISHUB_USER,
         format: 1,
         output: 'json',
         compress: 0,
         latmin: bounds[1],
         latmax: bounds[3],
         lonmin: bounds[0],
         lonmax: bounds[2]
       }
     });
     
     // Transform to GeoJSON
     const geojson = transformAIStoGeoJSON(response.data);
     
     // Cache for 5 minutes
     res.set('Cache-Control', 'public, max-age=300');
     res.json(geojson);
   });
   ```

4. **Frontend dynamic layer**
   - Load vessels on map view change
   - Auto-refresh every 5 minutes
   - Vessel icons by type (cargo, tanker, icebreaker)

### Phase 2: Enhanced Commercial Data (If Budget Approved)

**Option**: MarineTraffic/Kpler API
- Better coverage in remote Arctic
- Higher update frequency
- Historical track playback
- Port call predictions

**Monthly Cost**: $50-500 depending on usage

### Phase 3: Regional Government APIs

Add Norwegian (Barentswatch) and Canadian (upcoming research) APIs for complete Arctic coverage.

---

## Arctic Coverage Map

```
Northern Sea Route (Russian Arctic):
├── Western Section: Barentswatch (good)
├── Central Section: AISHub (moderate), MarineTraffic (excellent)
└── Eastern Section: AISHub (sparse), MarineTraffic (good)

Northwest Passage (Canadian Arctic):
├── NOAA Marine Cadastre (historical - excellent)
├── AISHub (moderate)
└── MarineTraffic (excellent)

Bering Strait / Alaska Arctic:
├── NOAA Marine Cadastre (excellent)
├── AISHub (good)
└── MarineTraffic (excellent)

Barents Sea / Svalbard:
├── Barentswatch (excellent)
├── AISHub (good)
└── MarineTraffic (excellent)
```

---

## Data Format Standards

### GeoJSON Output (MMGIS Standard)
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-150.5, 71.3]
      },
      "properties": {
        "mmsi": 219018938,
        "name": "POLAR EXPLORER",
        "callsign": "OY1234",
        "imo": 9123456,
        "vesselType": 70,
        "vesselTypeText": "Cargo",
        "speed": 8.5,
        "course": 245,
        "heading": 248,
        "destination": "RESOLUTE BAY",
        "eta": "2024-01-25T14:30:00Z",
        "lastUpdate": "2024-01-20T08:15:23Z",
        "navigationStatus": "Under way using engine",
        "dimensions": {
          "length": 120,
          "width": 20,
          "draught": 6.5
        }
      }
    }
  ]
}
```

### Vessel Type Codes (AIS Standard)
```
20-29: Wing in ground
30: Fishing
31-32: Towing
33: Dredging
34: Diving
35: Military
36: Sailing
37: Pleasure craft
40-49: High speed craft
50: Pilot vessel
51: Search and rescue
52: Tug
53: Port tender
54: Anti-pollution
55: Law enforcement
56-57: Spare
58: Medical
59: Non-combatant ship
60-69: Passenger
70-79: Cargo
80-89: Tanker
90-99: Other
```

---

## Testing Plan

### Week 1: Data Source Testing
- [ ] Register for AISHub access (submit today)
- [ ] Test NOAA WMS layer integration
- [ ] Verify Arctic data availability
- [ ] Document data quality in different regions

### Week 2: Backend Implementation
- [ ] Create `/api/arctic/vessels/live` endpoint
- [ ] Implement GeoJSON transformation
- [ ] Add Redis caching (5 min TTL)
- [ ] Test with various bounding boxes

### Week 3: Frontend Integration
- [ ] Dynamic vessel layer in MMGIS
- [ ] Vessel icon markers
- [ ] Info popup on click
- [ ] Auto-refresh mechanism
- [ ] Filter by vessel type

### Week 4: Optimization
- [ ] Load testing with high vessel counts
- [ ] Implement clustering for dense areas
- [ ] Add vessel track history
- [ ] Performance profiling

---

## Cost Analysis

### Free Tier Solution (Recommended for Start)
| Component | Cost | Coverage |
|-----------|------|----------|
| AISHub | $0 | Global (with gaps) |
| NOAA Marine Cadastre | $0 | U.S. Arctic (excellent) |
| Barentswatch | $0 | Norwegian Arctic |
| MMGIS Backend | $0 | Already deployed |
| **Total Monthly** | **$0** | **Good Arctic coverage** |

### Commercial Solution (If Needed)
| Component | Cost/Month | Coverage |
|-----------|------------|----------|
| MarineTraffic Starter | $50-100 | Global (excellent) |
| NOAA (supplement) | $0 | U.S. Arctic |
| Barentswatch (supplement) | $0 | Norwegian Arctic |
| **Total Monthly** | **$50-100** | **Excellent Arctic coverage** |

### Enterprise Solution (Full Features)
| Component | Cost/Month | Coverage |
|-----------|------------|----------|
| MarineTraffic Professional | $500+ | Global (real-time) |
| Historical track API | Included | Full playback |
| Port predictions | Included | ETA forecasts |
| **Total Monthly** | **$500+** | **Complete solution** |

---

## Next Actions

### Immediate (This Week):
1. ✅ Complete this evaluation document
2. ⏳ Register for AISHub research access
3. ⏳ Test NOAA WMS layer in MMGIS
4. ⏳ Create proof-of-concept with static vessel markers

### Short Term (2 Weeks):
1. Implement AISHub backend proxy
2. Add dynamic vessel layer to MMGIS
3. Test real-time updates
4. Document Arctic coverage gaps

### Medium Term (1 Month):
1. Evaluate MarineTraffic trial if needed
2. Integrate Barentswatch for Norwegian Arctic
3. Combine with SFNO ice predictions
4. Build route suggestion algorithm

---

## Resources

### Documentation
- AISHub API: http://www.aishub.net/api
- NOAA Marine Cadastre: https://marinecadastre.gov/ais/
- Barentswatch API: https://www.barentswatch.no/en/api/
- AIS Message Decoder (pyAIS): https://github.com/M0r13n/pyais

### Standards
- ITU-R M.1371: AIS Technical Standard
- IMO Polar Code: Ice navigation guidelines
- NMEA 0183: AIS sentence formats

### Open Source Tools
- pyAIS: Python AIS decoder
- AIS-catcher: SDR-based AIS receiver
- OpenCPN: Marine navigation software
- Ais.Net: .NET AIS decoder

---

## Conclusion

**Recommended Path Forward**: Start with **AISHub** (free, community-driven) combined with **NOAA Marine Cadastre** (historical U.S. Arctic data) for immediate prototype development. This gives zero-cost access to real-time vessel positions while building the MMGIS integration framework.

If Arctic coverage gaps are identified after testing, evaluate **MarineTraffic/Kpler** commercial API (~$50-100/month) for comprehensive global coverage.

The combination of free data sources provides sufficient coverage for proof-of-concept and can be supplemented with commercial APIs if the project scales to operational use.
