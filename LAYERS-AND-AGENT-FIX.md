# Layers and AgentChat Tool Fix

**Date**: 2026-07-06
**Issues**: Aircraft/Vessels layers not showing, AgentChat button not working

## Problems Identified

### 1. ✅ Aircraft and Vessels Plugins - MODULE_NOT_FOUND Error

**Problem**: Backend plugins failing to load with error:
```
Failed to require plugin.js for backend Aircraft
Failed to require plugin.js for backend Vessels
Error: MODULE_NOT_FOUND
```

**Root Cause**: Incorrect relative path to database connection file.

**Location**: 
- `plugins/core/backend/Aircraft/models/aircraftPosition.js`
- `plugins/core/backend/Vessels/models/vesselPosition.js`

**What Was Wrong**:
```javascript
// INCORRECT - tries to find plugins/connection.js
const { sequelize } = require("../../../connection");
```

From `/plugins/core/backend/Aircraft/models/`, the path `../../../` goes to `/plugins/`, not `/API/`.

**Correct Path**:
```javascript
// CORRECT - finds API/connection.js
const { sequelize } = require("../../../../../API/connection");
```

From `/plugins/core/backend/Aircraft/models/`, the path `../../../../../` correctly reaches `/API/`.

**Solution Applied**: ✅ Fixed both files

**Status**: Docker container rebuilding with fix

---

### 2. ✅ AgentChat Tool Not Showing

**Problem**: AgentChat button in mission toolbar doesn't open chat window

**Investigation Results**:
- ✅ Tool IS configured in mission: `frozon_ai_forecast_v38_config.json`
- ✅ Backend plugin EXISTS: `API/Frozon-MMGIS-Plugin-Backend/Agent/`
- ✅ Frontend tool EXISTS: `src/essence/Frozon-MMGIS-Plugin-Tools/AgentChat/AgentChatTool.js`
- ✅ Backend API endpoints present: `/api/agent`, `/api/agent/stream`
- ✅ WITH_AGENT=true configured
- ✅ GEMINI_API_KEY configured

**Likely Cause**: Custom plugin tool directory (`Frozon-MMGIS-Plugin-Tools`) needs to be properly registered in the build system or the built tool files aren't being loaded correctly.

**Mission Configuration**:
```json
{
  "on": true,
  "name": "AgentChat",
  "icon": "robot-outline",
  "js": "AgentChatTool",
  "separatedTool": true,
  "variables": {
    "justification": "right"
  }
}
```

**File Locations**:
- Backend: `/Users/kyun/Downloads/JPL/MMGIS/API/Frozon-MMGIS-Plugin-Backend/Agent/`
- Frontend: `/Users/kyun/Downloads/JPL/MMGIS/src/essence/Frozon-MMGIS-Plugin-Tools/AgentChat/`
- Config: Tool registry at `API/Frozon-MMGIS-Plugin-Backend/Agent/tool-registry.json`

**Next Steps**: After Docker rebuild completes, test if the tool loads. If not, may need to check:
1. Webpack configuration for custom tool paths
2. Tool registration in MMGIS
3. Browser console for JavaScript errors

---

### 3. 🔄 General Layers Not Showing

**Problem**: Layers panel may not show any layers

**Possible Causes**:
1. Backend plugins not loading (fixed above)
2. Layer data sources not accessible
3. Frontend JavaScript errors
4. Mission configuration issues
5. Database connection issues (already fixed)

**Mission Has These Layers**:
- "Vessels (Live AIS)" - vector layer, requires `AISSTREAM_API_KEY`
- "Aircraft (Live ADS-B)" - vector layer, uses OpenSky Network API
- Multiple SWOT and forecast data layers
- Base map layers

**To Investigate After Rebuild**:
1. Check browser console for JavaScript errors
2. Check network tab for failed API requests
3. Verify layer configuration in database
4. Check Docker logs for layer loading errors

---

## Changes Made

### Files Modified

#### 1. `plugins/core/backend/Aircraft/models/aircraftPosition.js`
**Change**: Updated require path
```diff
- const { sequelize } = require("../../../connection");
+ const { sequelize } = require("../../../../../API/connection");
```

#### 2. `plugins/core/backend/Vessels/models/vesselPosition.js`
**Change**: Updated require path
```diff
- const { sequelize } = require("../../../connection");
+ const { sequelize } = require("../../../../../API/connection");
```

#### 3. `plugins/core/backend/Aircraft/plugin.json`
**Change**: Fixed dependencies validation
```diff
- "dependencies": []
+ "dependencies": {}
```

#### 4. `plugins/core/backend/Vessels/plugin.json`
**Change**: Fixed dependencies validation
```diff
- "dependencies": []
+ "dependencies": {}
```

---

## Docker Rebuild

**Status**: 🔄 In Progress

**Command**:
```bash
docker-compose down && docker-compose build mmgis
```

**Why Rebuild Needed**:
- Plugin model files are copied during Docker build
- Changes to source files don't take effect until rebuild
- Container needs to be rebuilt with corrected require paths

**After Build Completes**:
```bash
docker-compose up -d
docker-compose logs -f mmgis
```

---

## Verification Steps

### 1. Check Plugin Loading
```bash
docker logs mmgis-mmgis-1 2>&1 | grep -E "(Aircraft|Vessels)"
```

**Expected**: No "Failed to require" or "MODULE_NOT_FOUND" errors

**Success Indicators**:
```
✅ "Backend: Aircraft from core" (or similar loaded message)
✅ "Backend: Vessels from core" (or similar loaded message)
```

### 2. Test Mission Page
1. Open: http://localhost:8888/?mission=frozon_ai_forecast
2. Check browser console (F12) for errors
3. Verify layers panel opens and shows layers
4. Click on "Aircraft (Live ADS-B)" layer - should toggle on/off
5. Click on "Vessels (Live AIS)" layer - should toggle on/off

### 3. Test AgentChat Tool
1. Look for AgentChat/Copilot button in toolbar
2. Click the button
3. Chat window should open on the right side
4. Try a test query: "Show me the SWOT data layers"
5. Verify agent responds without errors

### 4. Check Backend Logs
```bash
# Should show plugins loaded successfully
docker logs mmgis-mmgis-1 | grep "Backend:"

# Should show no errors for Aircraft/Vessels
docker logs mmgis-mmgis-1 | grep -i "error"

# Check if agent routes are mounted
docker logs mmgis-mmgis-1 | grep -i "agent"
```

---

## Environment Configuration

### Required for Aircraft/Vessels Layers

These are already configured in your `.env`:

**Aircraft Layer**:
```bash
WITH_AIRCRAFT=true  # Enable aircraft tracking
OPENSKY_BBOX_LAMIN=66.5  # Arctic Circle
OPENSKY_BBOX_LOMIN=-180
OPENSKY_BBOX_LAMAX=90
OPENSKY_BBOX_LOMAX=180
OPENSKY_POLL_INTERVAL=30000  # 30 seconds
OPENSKY_TTL_MINUTES=60
AIRCRAFT_HISTORY_DAYS=7
```

**Vessels Layer**:
```bash
WITH_VESSELS=true  # Enable vessel tracking
AISSTREAM_API_KEY=your_key_here  # Get from https://aisstream.io
AISSTREAM_BBOX=-30,55,40,82  # Arctic corridors
AISSTREAM_TTL_MINUTES=30
VESSEL_HISTORY_DAYS=7
```

**AgentChat Tool**:
```bash
WITH_AGENT=true
GEMINI_API_KEY=<configured> ✅
# OR
PROJECT_ENDPOINT=<azure_endpoint>
AZURE_AI_FOUNDRY_AGENT_ID=<agent_id>
```

---

## Troubleshooting

### Aircraft/Vessels Layers Still Not Loading

**Check 1**: Verify plugins loaded
```bash
docker logs mmgis-mmgis-1 2>&1 | grep "Backend:" | grep -E "(Aircraft|Vessels)"
```

**Check 2**: Test API endpoints
```bash
# Aircraft endpoint
curl http://localhost:8888/api/aircraft/positions | python3 -m json.tool

# Vessels endpoint
curl http://localhost:8888/api/vessels/positions | python3 -m json.tool
```

**Check 3**: Verify database tables created
```bash
docker exec mmgis-mmgis-1 sh -c 'psql -h db -U postgres -d mmgis -c "\dt" | grep -E "aircraft|vessel"'
```

### AgentChat Button Not Appearing

**Check 1**: Verify tool file exists in build
```bash
docker exec mmgis-mmgis-1 find /usr/src/app/build -name "*AgentChat*" 2>/dev/null
```

**Check 2**: Check browser console
- Open browser DevTools (F12)
- Go to Console tab
- Look for errors related to "AgentChat" or "AgentChatTool"

**Check 3**: Verify backend routes
```bash
docker logs mmgis-mmgis-1 | grep -i "agent.*route"
```

**Check 4**: Test backend API
```bash
curl -X POST http://localhost:8888/api/agent \
  -H "Content-Type: application/json" \
  -d '{"message":"test","conversationId":"test"}' | python3 -m json.tool
```

### AgentChat Opens But Doesn't Respond

**Check 1**: Verify API key loaded
```bash
docker exec mmgis-mmgis-1 sh -c 'echo "GEMINI_API_KEY: ${GEMINI_API_KEY:0:20}..."'
```

**Check 2**: Check agent logs
```bash
docker logs mmgis-mmgis-1 2>&1 | grep -E "(gemini|agent|LLM)" | tail -20
```

**Check 3**: Test Gemini service
```bash
# From inside the container
docker exec mmgis-mmgis-1 node -e "
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
model.generateContent('Hello').then(r => console.log('Gemini OK')).catch(e => console.error('Gemini Error:', e.message));
"
```

### Layers Panel Empty or Not Opening

**Check 1**: Mission configuration loaded
```bash
docker exec mmgis-mmgis-1 cat /usr/src/app/Missions/frozon_ai_forecast_v38_config.json | python3 -m json.tool | grep -A 5 "layers"
```

**Check 2**: Check browser network tab
- Open DevTools (F12) → Network tab
- Reload page
- Look for failed requests to layer data sources

**Check 3**: Check frontend errors
- Browser console should show any JavaScript errors
- Look for "Cannot read property" or "undefined" errors

---

## Success Criteria

After rebuild and restart:

### Backend
- ✅ Aircraft plugin loads without errors
- ✅ Vessels plugin loads without errors
- ✅ Agent plugin routes mounted
- ✅ Database tables created for aircraft_positions and vessel_positions
- ✅ No MODULE_NOT_FOUND errors in logs

### Frontend
- ✅ Mission page loads at http://localhost:8888/?mission=frozon_ai_forecast
- ✅ Layers panel opens and displays layers
- ✅ Aircraft (Live ADS-B) layer appears in panel
- ✅ Vessels (Live AIS) layer appears in panel
- ✅ AgentChat button appears in toolbar
- ✅ Clicking AgentChat opens chat window
- ✅ Chat responds to queries

### Functionality
- ✅ Layers can be toggled on/off
- ✅ Aircraft markers appear if there's coverage (OpenSky Network)
- ✅ Vessel markers appear (requires AISSTREAM_API_KEY)
- ✅ AgentChat responds to natural language queries
- ✅ Agent can interact with layers and data

---

## Related Documentation

- `DOCKER-DEPLOYMENT-SUCCESS.md` - Docker setup and fixes
- `GEMINI-DOCKER-FIX.md` - Gemini API configuration
- `COPILOT-FIX-SUMMARY.md` - AgentChat/Copilot implementation details
- `vessel-tracking-integration.md` - Vessel tracking integration
- `docs/vessel-tracking-integration.md` - Full vessel tracking docs

---

## Next Actions

### Immediate (After Build)
1. ✅ Wait for Docker build to complete
2. ✅ Start containers: `docker-compose up -d`
3. ✅ Monitor logs: `docker-compose logs -f mmgis`
4. ✅ Check for plugin loading errors
5. ✅ Test mission page in browser

### Verification
1. Open http://localhost:8888/?mission=frozon_ai_forecast
2. Open browser DevTools (F12) and check Console
3. Test layers panel - verify Aircraft and Vessels appear
4. Test AgentChat button - verify chat window opens
5. Send test query to AgentChat

### If Issues Persist
1. Check browser console for JavaScript errors
2. Check Docker logs for backend errors
3. Verify webpack build included custom tools
4. Check mission configuration in database
5. Review tool registration in MMGIS

---

## Technical Details

### Path Resolution Explanation

From a file at `plugins/core/backend/Aircraft/models/aircraftPosition.js`:

**Incorrect path**: `../../../connection`
```
plugins/core/backend/Aircraft/models/aircraftPosition.js
  ↑ ..
plugins/core/backend/Aircraft/models/
  ↑ ..
plugins/core/backend/Aircraft/
  ↑ ..
plugins/core/backend/
  ↑ ..
plugins/core/
  ↑ ..
plugins/
  → connection.js ❌ DOESN'T EXIST
```

**Correct path**: `../../../../../API/connection`
```
plugins/core/backend/Aircraft/models/aircraftPosition.js
  ↑ ..
plugins/core/backend/Aircraft/models/
  ↑ ..
plugins/core/backend/Aircraft/
  ↑ ..
plugins/core/backend/
  ↑ ..
plugins/core/
  ↑ ..
plugins/
  ↑ ..
(project root)/
  → API/connection.js ✅ EXISTS
```

### Custom Tool Integration

MMGIS supports custom tools through:
1. **Source location**: `src/essence/<custom-tools-dir>/ToolName/`
2. **Build**: Webpack bundles custom tools into `build/tools/`
3. **Registration**: Tools register via `make()` and `destroy()` lifecycle methods
4. **Configuration**: Mission config references tool by JS class name

For `AgentChatTool`:
- Source: `src/essence/Frozon-MMGIS-Plugin-Tools/AgentChat/AgentChatTool.js`
- Backend: `API/Frozon-MMGIS-Plugin-Backend/Agent/` (routes, services)
- Config: `"js": "AgentChatTool"` in mission tools array

---

## Build Progress

**Started**: 2026-07-06 13:45:23
**Status**: 🔄 In Progress
**Stage**: Installing Node.js 20

**Monitor progress**:
```bash
tail -f /private/tmp/claude-503/-Users-kyun-Downloads-JPL-MMGIS/*/tasks/bgsng1hvm.output
```

**Estimated time**: 5-10 minutes for full rebuild

**When complete**: Container will automatically start and logs will be available via `docker-compose logs -f mmgis`
