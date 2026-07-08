# Frontend Issues - Layer Toggle & AgentChat

**Date**: 2026-07-06
**Status**: Backend working ✅, Frontend issues identified

## Current Status

### ✅ Backend - Working Perfectly
- Aircraft plugin: Polling 15-26 aircraft every 30 seconds
- Vessels plugin: AIS stream subscribed and active
- API endpoints responding with data:
  - `/api/aircraft/live` - Returns 26 aircraft ✅
  - `/api/vessels/positions` - Returns vessel data ✅
- Database: Tables synced and persisting data ✅

### ❌ Frontend - Two Issues

#### Issue 1: Layer Toggle Shows Infinite Loading
**Symptom**: Clicking Aircraft or Vessels layer shows loading spinner indefinitely

#### Issue 2: AgentChat Button Doesn't Open Chat
**Symptom**: AgentChat button appears but clicking it doesn't open the chat window

---

## Issue 1: Layer Toggle Infinite Loading

### Investigation

**Backend**: ✅ Working perfectly
```bash
$ curl http://localhost:8888/api/aircraft/live
{
  "type": "FeatureCollection",
  "features": [26 aircraft with full data]
}
```

**Layer Configuration**: ✅ Looks correct
```json
{
  "name": "Aircraft (Live ADS-B)",
  "type": "vector",
  "url": "/api/aircraft/live",
  "time": {
    "enabled": true,
    "type": "requery",
    "refreshIntervalEnabled": true,
    "refreshIntervalAmount": 30
  }
}
```

### Possible Causes

1. **Time-based layer loading issue**
   - Layer has `time.enabled: true` with `requery` type
   - May be waiting for time bounds that don't exist
   - Time properties: `startProp` and `endProp` set to `last_contact`

2. **Frontend rendering delay**
   - Layer might be loading but render is blocked
   - JavaScript error preventing completion
   - Event handler not firing

3. **Missing frontend renderer**
   - Custom vector layers may need specific renderers
   - AgentChat tool may have custom rendering code

### Debugging Steps

#### Check Browser Console
```
1. Open http://localhost:8888/?mission=frozon_ai_forecast
2. Press F12 to open DevTools
3. Go to Console tab
4. Click to toggle Aircraft layer
5. Look for errors like:
   - "Cannot read property..."
   - "Undefined function..."
   - "Failed to load..."
```

#### Check Network Tab
```
1. DevTools → Network tab
2. Filter by "aircraft"
3. Toggle the layer
4. Check if request is made to /api/aircraft/live
5. Check response status and data
```

#### Check for Time Issues
The layer configuration uses time-based querying. The issue might be:
- Layer waiting for time bounds to be set
- Time control not initialized properly
- Query hanging on time parameter

**Potential Fix**: Disable time temporarily
```json
{
  "time": {
    "enabled": false  // Try this temporarily
  }
}
```

---

## Issue 2: AgentChat Button Doesn't Open Chat

### Investigation

**Button Appears**: ✅ Yes - means tool is partially loaded

**Click Action**: ❌ Nothing happens - event handler issue

### Possible Causes

1. **Tool not properly initialized**
   - Tool loads but `make()` method fails
   - Initialization error prevents panel creation

2. **JavaScript error in tool code**
   - Error in AgentChatTool.js prevents execution
   - Missing dependency or import issue

3. **Custom tool path not in webpack build**
   - Tool source exists: `src/essence/Frozon-MMGIS-Plugin-Tools/AgentChat/`
   - May not be included in webpack compilation
   - Needs to be registered in build system

4. **DOM element creation failure**
   - Tool tries to create overlay but fails
   - CSS not loaded
   - Parent element doesn't exist

### Debugging Steps

#### Check Browser Console
```
1. Open DevTools (F12) → Console
2. Click the AgentChat button
3. Look for errors:
   - "Failed to initialize AgentChatTool"
   - "Cannot find element..."
   - Any red error messages
```

#### Check Network Tab
```
1. DevTools → Network tab
2. Click AgentChat button
3. Check if ANY requests are made
4. Look for failed CSS or JS loads
```

#### Test Backend API Directly
```bash
curl -X POST http://localhost:8888/api/agent \
  -H "Content-Type: application/json" \
  -d '{"message":"test","conversationId":"test123"}' | python3 -m json.tool
```

**Expected**: Response from Gemini with agent data

**If fails**: Backend Agent plugin not loaded

### Solution Approaches

#### Option 1: Check Tool Registration
The tool needs to be registered in MMGIS's tool system.

**Check**: Does `src/essence/Frozon-MMGIS-Plugin-Tools/` get scanned by webpack?

**Files to check**:
- `webpack.config.js` - Tool paths configuration
- `src/essence/Tools.js` or similar - Tool registry
- Build logs for webpack warnings

#### Option 2: External Plugin Loading
The Frozon plugins are in non-standard locations:
- Backend: `API/Frozon-MMGIS-Plugin-Backend/`
- Frontend: `src/essence/Frozon-MMGIS-Plugin-Tools/`

**May need**:
- Explicit plugin loading configuration
- Symlinks to standard plugin locations
- Custom webpack resolve paths

#### Option 3: Backend Plugin Not Loaded
Check if the Agent backend plugin mounted routes:

```bash
docker logs mmgis-mmgis-1 | grep -i "agent.*route"
```

**Expected**: Should see route mounting for `/api/agent`

**If missing**: Backend plugin not loading from `API/Frozon-MMGIS-Plugin-Backend/Agent/`

---

## Quick Diagnostic Commands

### Check Backend Agent Plugin
```bash
# Check if agent routes exist
docker exec mmgis-mmgis-1 sh -c 'curl -s http://localhost:8888/api/agent/tools 2>/dev/null | head -20'

# Check backend logs for Agent plugin
docker logs mmgis-mmgis-1 | grep -i "frozon\|agent.*backend"

# Test agent API
curl -X POST http://localhost:8888/api/agent \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","conversationId":"test"}' | python3 -m json.tool
```

### Check Frontend Build
```bash
# Search for AgentChat in build
docker exec mmgis-mmgis-1 grep -r "AgentChat" /usr/src/app/build/ 2>/dev/null | head -5

# Check if Frozon tools compiled
docker exec mmgis-mmgis-1 grep -r "Frozon" /usr/src/app/build/ 2>/dev/null | head -5
```

### Browser Console Commands
```javascript
// Check if tool is registered
console.log(window.mmgisAPI);
console.log(ToolController_);

// Check if AgentChatTool exists
console.log(typeof AgentChatTool);

// Try to manually open tool
if (typeof AgentChatTool !== 'undefined' && AgentChatTool.make) {
  AgentChatTool.make();
}
```

---

## Immediate Actions Needed

### For Layer Toggle Issue

**Please provide**:
1. Browser console output when toggling Aircraft layer
2. Network tab showing the `/api/aircraft/live` request
3. Any red errors in console

**To test**:
```
1. Open http://localhost:8888/?mission=frozon_ai_forecast
2. Open DevTools (F12)
3. Go to Console tab
4. Click Aircraft layer to toggle
5. Copy all console output
6. Go to Network tab, find /api/aircraft/live request
7. Check response
```

### For AgentChat Issue

**Please provide**:
1. Browser console output when clicking AgentChat button
2. Result of testing backend API (curl command above)
3. Any JavaScript errors

**To test**:
```
1. F12 → Console
2. Click AgentChat/Copilot button (robot icon)
3. Copy any errors
4. Try typing in console: AgentChatTool
5. Share the output
```

---

## Temporary Workarounds

### For Layers
If time-based querying is the issue:

1. Edit mission config to disable time temporarily
2. Or try accessing layers via direct API:
   ```
   http://localhost:8888/api/aircraft/live
   http://localhost:8888/api/vessels/positions
   ```

### For AgentChat
If tool isn't loading:

1. Test backend API directly with curl
2. If backend works, issue is frontend-only
3. May need to rebuild with custom tool path in webpack

---

## What Works vs. What Doesn't

### ✅ Confirmed Working

**Backend**:
- Aircraft plugin fully functional
- Vessels plugin fully functional  
- OpenSky API polling: 26 aircraft tracked
- AIS stream connected and active
- Database persistence working
- API endpoints returning data

**Frontend**:
- Mission page loads
- Layers panel opens
- Aircraft layer appears in list
- Vessels layer appears in list
- AgentChat button appears in toolbar

### ❌ Not Working

**Frontend**:
- Layer toggle shows infinite loading (backend returns data correctly)
- AgentChat button click has no effect (no chat window opens)

---

## Next Steps

1. **Get browser console output** for both issues
2. **Check network tab** for failed requests
3. **Test backend APIs** directly to confirm they work
4. **Check webpack configuration** for custom tool paths

The backend is solid - both issues are frontend-related. With browser console output, we can pinpoint the exact JavaScript errors and fix them.

---

## Related Files

- Backend Aircraft: `plugins/core/backend/Aircraft/`
- Backend Vessels: `plugins/core/backend/Vessels/`
- Backend Agent: `API/Frozon-MMGIS-Plugin-Backend/Agent/`
- Frontend AgentChat: `src/essence/Frozon-MMGIS-Plugin-Tools/AgentChat/`
- Mission config: `Missions/frozon_ai_forecast_v38_config.json`
- Webpack config: `webpack.config.js`
