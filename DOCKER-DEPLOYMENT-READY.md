# Docker Deployment Status - Aircraft Tracking

**Status**: 🔄 Docker build in progress  
**Date**: 2026-06-30  

---

## ✅ Completed Setup Steps

### 1. Code Implementation
- ✅ Backend plugin: `API/MMGIS-Plugin-Backend/Aircraft/`
- ✅ Frontend plugin: `src/essence/MMGIS-Plugin-Tools/AircraftVisualization/`
- ✅ Mission config: `Missions/frozon_v116_config.json` (aircraft layer added)
- ✅ ENV documentation: `sample.env`, `docs/pages/Setup/ENVs/ENVs.md`

### 2. Docker Configuration
- ✅ `docker-compose.yml` created from sample
- ✅ Changed to use local build: `build: .` instead of pulling image
- ✅ `.env` updated with aircraft configuration:
  ```bash
  WITH_AIRCRAFT=true
  OPENSKY_BBOX_LAMIN=66.5     # Full Arctic Circle
  OPENSKY_BBOX_LOMIN=-180
  OPENSKY_BBOX_LAMAX=90
  OPENSKY_BBOX_LOMAX=180
  OPENSKY_POLL_INTERVAL=30000 # 30 seconds
  OPENSKY_TTL_MINUTES=60      # 1 hour cache
  AIRCRAFT_HISTORY_DAYS=7     # 7 days retention
  ```

### 3. Docker Build
- 🔄 Building image: `docker build -t mmgis:latest .`
- ⏱️ ETA: 5-10 minutes
- 📍 Build log: Check background task output

---

## 🚀 Next Steps (After Build Completes)

### 1. Verify Build Success
```bash
cd /Users/kyun/Downloads/JPL/MMGIS
docker images | grep mmgis
```

Expected output: `mmgis  latest  <image-id>  <timestamp>`

### 2. Start Containers
```bash
docker compose up -d
```

This will:
- Start PostgreSQL with PostGIS
- Start MMGIS with aircraft plugin enabled
- Start adjacent services (STAC, TiTiler, etc.)

### 3. Verify Services Are Running
```bash
docker compose ps
```

Expected:
```
NAME              STATUS                 PORTS
mmgis-mmgis-1     running (healthy)      0.0.0.0:8888->8888/tcp
mmgis-db-1        running (healthy)      5432/tcp
...
```

### 4. Check Aircraft Plugin Logs
```bash
docker compose logs -f mmgis | grep Aircraft
```

Expected output:
```
[Aircraft] Routes mounted at /api/aircraft
[Aircraft] Client started
[Aircraft] aircraft_positions table synced
[Aircraft] Polled X aircraft
```

### 5. Test Aircraft API
```bash
# Check status
curl http://localhost:8888/api/aircraft/status | jq '.'

# Expected: {"enabled": true, "isRunning": true, "cacheSize": X, ...}

# Check live positions
curl http://localhost:8888/api/aircraft/live | jq '.features | length'

# Expected: Number (may be 0 if no aircraft currently in Arctic)
```

### 6. Test Frontend Visualization
1. Open: http://localhost:8888/?mission=frozon
2. Open **Layers Tool** (left sidebar)
3. Find and enable **"Aircraft (Live ADS-B)"** layer
4. Wait ~30 seconds for first poll
5. Look for blue circle markers (aircraft)
6. Click any aircraft to see:
   - Rich popup with metadata
   - Auto-drawn 24-hour track (if data exists)
   - Flightradar24 link

---

## 🔍 Troubleshooting

### Build Failed
```bash
# Check build logs
docker build -t mmgis:latest . 2>&1 | tee build.log

# Common issues:
# - Network timeout: Retry build
# - Disk space: docker system prune -a
# - Architecture mismatch: Check Dockerfile
```

### Containers Won't Start
```bash
# Check logs
docker compose logs mmgis

# Check .env file
grep WITH_AIRCRAFT .env

# Ensure PostgreSQL is ready
docker compose logs db | grep "database system is ready"
```

### No Aircraft Appearing
```bash
# Check if OpenSky API is reachable
curl 'https://opensky-network.org/api/states/all?lamin=66.5&lomin=-180&lamax=90&lomax=180'

# Check backend logs
docker compose logs mmgis | grep -E "(Aircraft|OpenSky)"

# May be sparse coverage in Arctic - try broader bbox:
# Edit .env: OPENSKY_BBOX_LAMIN=45 (includes northern Europe)
docker compose restart mmgis
```

### Layer Not Visible
```bash
# Check mission config has aircraft layer
jq '.layers[] | select(.name=="Aircraft (Live ADS-B)")' Missions/frozon_v116_config.json

# Check layer URL
curl http://localhost:8888/api/aircraft/live

# Clear browser cache and hard refresh (Cmd+Shift+R)
```

---

## 📊 Expected Performance

### API Response Times
- `/api/aircraft/live`: ~50-200ms (depends on cache size)
- `/api/aircraft/track`: ~100-500ms (depends on history)
- `/api/aircraft/status`: ~5-10ms

### Resource Usage
- Memory: +100-200MB (depends on aircraft count)
- CPU: Minimal (polling every 30s)
- Disk: ~1-2MB/day (track history)

### OpenSky Rate Limits
- **Free Tier**: 5 requests per 10 seconds
- **Daily Limit**: 400 requests per day per IP
- **Our Config**: 30s interval = 2,880 requests/day ❌ **Exceeds limit!**

**⚠️ IMPORTANT**: The default 30-second interval will exceed the daily limit. You should either:
1. Increase interval to 60s: `OPENSKY_POLL_INTERVAL=60000`
2. Get authenticated API access (higher limits)
3. Accept that polling will stop after ~5 hours per day

### Arctic Coverage
- **Good Coverage**: Northern Europe, Russia west of Urals, Canada, Alaska
- **Sparse Coverage**: Central Arctic Ocean, Siberia, Greenland interior
- **No Coverage**: Open ocean, ice sheets (no ADS-B receivers)

---

## 🔧 Configuration Options

### Adjust Coverage Area
Edit `.env`:
```bash
# Laptev Sea only (narrower focus)
OPENSKY_BBOX_LAMIN=70
OPENSKY_BBOX_LOMIN=100
OPENSKY_BBOX_LAMAX=81
OPENSKY_BBOX_LOMAX=145

# Northern Hemisphere (broader coverage, more aircraft)
OPENSKY_BBOX_LAMIN=45
OPENSKY_BBOX_LOMIN=-180
OPENSKY_BBOX_LAMAX=90
OPENSKY_BBOX_LOMAX=180
```

Then restart: `docker compose restart mmgis`

### Adjust Update Frequency
Edit `.env`:
```bash
# More frequent updates (uses more API quota)
OPENSKY_POLL_INTERVAL=20000  # 20 seconds

# Less frequent updates (conserves API quota)
OPENSKY_POLL_INTERVAL=120000  # 2 minutes
```

### Adjust History Retention
Edit `.env`:
```bash
# Shorter history (less disk space)
AIRCRAFT_HISTORY_DAYS=3

# Longer history (more disk space)
AIRCRAFT_HISTORY_DAYS=14

# No persistence (in-memory only)
AIRCRAFT_HISTORY_DAYS=0
```

---

## 📝 Quick Commands Reference

```bash
# Build image
docker build -t mmgis:latest .

# Start all services
docker compose up -d

# Stop all services
docker compose down

# Restart MMGIS only
docker compose restart mmgis

# View logs (follow)
docker compose logs -f mmgis

# View logs (last 100 lines)
docker compose logs --tail=100 mmgis

# Check status
docker compose ps

# Clean rebuild
docker compose down
docker build --no-cache -t mmgis:latest .
docker compose up -d

# Check database
docker compose exec db psql -U postgres -d mmgis -c "SELECT COUNT(*) FROM aircraft_positions;"

# Shell into container
docker compose exec mmgis /bin/bash
```

---

## 📚 Related Documentation

- **Implementation Summary**: `AIRCRAFT-TRACKING-IMPLEMENTATION.md`
- **Frontend Plugin**: `src/essence/MMGIS-Plugin-Tools/AircraftVisualization/README.md`
- **Plan Document**: `/Users/kyun/.claude/plans/whimsical-stargazing-beacon.md`
- **OpenSky API Docs**: https://opensky-network.org/apidoc/

---

## ✅ Checklist

- [x] Code implemented (backend + frontend)
- [x] Mission config updated
- [x] docker-compose.yml created
- [x] .env updated with aircraft settings
- [ ] Docker build completed ⏳ **In Progress**
- [ ] Containers started
- [ ] Aircraft API responding
- [ ] Frontend layer visible
- [ ] Popups working
- [ ] Tracks drawing on click

---

**Once the build completes, run**: `docker compose up -d`
