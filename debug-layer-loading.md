# Debug Aircraft Layer Loading Issue

## Current Status Verified

✅ **Database**: time.enabled = false (optimized)  
✅ **API Config**: time.enabled = false (correct)  
✅ **API Data**: Responding in ~50ms  
✅ **Aircraft Count**: 17 cached  

The server side is correct. The issue is likely:
1. Browser is still using cached config
2. Browser console has JavaScript errors
3. Network/CORS issue blocking the request

## Step-by-Step Debugging

### Step 1: Verify Browser Cache is Clear

1. Open http://localhost:8888/?mission=frozon_ai_forecast
2. Press **F12** to open DevTools
3. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
4. Click **Clear storage** / **Clear site data**
5. Check all boxes
6. Click **Clear site data**
7. **Close the browser completely** and reopen

### Step 2: Check Network Activity

1. Open http://localhost:8888/?mission=frozon_ai_forecast
2. Press **F12** → **Network** tab
3. Click **Layers** tool
4. Enable **Aircraft (Live ADS-B)** layer
5. Watch the Network tab for:
   - Request to `/api/configure/get?mission=frozon_ai_forecast`
   - Request to `/api/aircraft/live`

**What to look for:**
- Are these requests appearing?
- What are the response times?
- Any failed requests (red)?
- Any pending requests (gray)?

### Step 3: Check Console Errors

1. Still in DevTools
2. Go to **Console** tab
3. Look for any errors (red text)

**Common errors:**
- `CORS policy` errors
- `Failed to fetch` errors
- JavaScript syntax errors
- `undefined` or `null` reference errors

### Step 4: Check Request Details

In the Network tab, click on the `/api/aircraft/live` request:
- **Status**: Should be 200 OK
- **Size**: Should be ~5-10 KB
- **Time**: Should be < 100ms
- **Preview**: Should show GeoJSON with features array

### Step 5: Try Direct API Test

Open a new browser tab and go directly to:
```
http://localhost:8888/api/aircraft/live
```

**Expected result**: JSON with aircraft data should display immediately

**If this is slow**: The problem is server-side, not browser cache

### Step 6: Try Incognito/Private Mode

1. Open browser in Incognito/Private mode
2. Go to http://localhost:8888/?mission=frozon_ai_forecast
3. Enable aircraft layer

**If this works fast**: Confirms it's a cache issue in your main browser

## Common Issues & Solutions

### Issue 1: Browser Cached Old Config

**Symptoms:**
- Layer list only shows 4 layers
- Aircraft/Vessel layers not visible

**Solution:**
```bash
# Clear browser cache completely:
1. Chrome: Ctrl+Shift+Delete → Check "Cached images and files" → Clear
2. Firefox: Ctrl+Shift+Delete → Check "Cache" → Clear
3. Close browser completely, reopen
```

### Issue 2: Time Control Waiting

**Symptoms:**
- Layer shows loading spinner
- Network tab shows `/api/aircraft/live` not being called
- Console shows "Waiting for time controls..."

**Check:**
```javascript
// In browser console (F12), check:
window.mmgisglobal
// Look for time-related settings
```

**Solution:**
The optimization should have fixed this. If persisting, check if config really updated:
```bash
curl -s "http://localhost:8888/api/configure/get?mission=frozon_ai_forecast" | \
  jq '.layers[-1].time.enabled'
# Should return: false
```

### Issue 3: CORS/Network Policy

**Symptoms:**
- Network tab shows request failed
- Console shows CORS errors
- Request shows (cancelled) or (failed)

**Solution:**
```bash
# Check if API is accessible:
curl http://localhost:8888/api/aircraft/live

# Should return JSON data, not an error
```

### Issue 4: JavaScript Error Breaking Layer Load

**Symptoms:**
- Console shows red error messages
- Layer doesn't load at all
- Other layers work fine

**Check Console for:**
- `TypeError: Cannot read property 'x' of undefined`
- `ReferenceError: x is not defined`
- Any red error text

**Solution:**
Copy the error and investigate the specific issue.

### Issue 5: Docker Container Restarted

**Symptoms:**
- Layer worked before, stopped working
- Other services also slow

**Check:**
```bash
docker-compose ps
# All should show "Up" and "healthy"

docker logs mmgis-mmgis-1 --tail 50
# Check for errors
```

## Force Complete Refresh

If nothing else works, try this nuclear option:

```bash
# 1. Stop containers
docker-compose down

# 2. Clear browser cache completely
# Do this manually in browser settings

# 3. Start containers fresh
docker-compose up -d

# 4. Wait for healthy status
sleep 15

# 5. Test API directly
curl http://localhost:8888/api/aircraft/live | jq '.features | length'

# 6. Open browser in incognito mode
# Go to http://localhost:8888/?mission=frozon_ai_forecast
```

## Check What Browser Cached

### Chrome DevTools:
1. F12 → Network tab
2. Disable cache checkbox (top of Network tab)
3. Reload page

### See Cached Config:
1. F12 → Application tab
2. Storage → Local Storage → http://localhost:8888
3. Look for mission config keys
4. **Delete all** local storage items
5. Reload page

## Test Loading Speed

### Method 1: Browser DevTools Performance
1. F12 → Performance tab
2. Click Record
3. Enable aircraft layer
4. Stop recording
5. Look at timeline - should be < 500ms total

### Method 2: Network Tab
1. F12 → Network tab
2. Clear (trash icon)
3. Enable aircraft layer
4. Check timing:
   - `/api/configure/get?mission=...` - should be < 200ms
   - `/api/aircraft/live` - should be < 100ms

## What "Loading Too Long" Means

Please clarify:
- **How long is it taking?** (5 seconds? 30 seconds? Never completes?)
- **At what point does it hang?** (Loading spinner? Blank? Error?)
- **Does it eventually load?** (Or does it timeout/fail?)
- **What does Network tab show?** (Pending? Failed? Slow?)

## Quick Test Commands

Run these to verify everything is working:

```bash
# 1. Check config has optimization
curl -s "http://localhost:8888/api/configure/get?mission=frozon_ai_forecast" | \
  jq '.layers[-1] | {name, time_enabled: .time.enabled, url}'

# 2. Check API speed
time curl -s http://localhost:8888/api/aircraft/live > /dev/null

# 3. Check aircraft count
curl -s http://localhost:8888/api/aircraft/live | jq '.features | length'

# 4. Check plugin status
curl -s http://localhost:8888/api/aircraft/status | jq .
```

All four should respond quickly (< 1 second each).

## Expected Behavior

When working correctly:
1. **Layer appears in list** (after hard refresh)
2. **Toggle ON takes ~200ms**
3. **Markers appear immediately**
4. **No loading spinner** (or < 1 second)
5. **10-20 blue circles** on Arctic map
6. **Auto-refreshes every 30 seconds**

## Next Steps

Please provide:
1. **Browser console output** (F12 → Console tab, screenshot or copy errors)
2. **Network tab timing** (F12 → Network tab, what shows for `/api/aircraft/live`?)
3. **How long it takes** (exact seconds)
4. **Does it complete or hang forever?**

This will help identify the exact issue.
