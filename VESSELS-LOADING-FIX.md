# Vessels Layer Infinite Loading Fix

**Date:** 2026-07-06  
**Issue:** Vessels layer shows infinite loading spinner when selected  
**Status:** ✅ Fixed

## Problem

When the "Vessels (Live AIS)" layer was toggled on in the frozon_ai_forecast mission, it would display an infinite loading spinner even though:
- The API endpoint `/api/vessels/live` was working correctly
- The backend was successfully fetching and returning vessel data (3,203 vessels)
- No errors were appearing in the console

## Root Cause

Vector layers in MMGIS were not integrated with the global loading spinner system (`setGlobalLoading`/`setGlobalLoaded`).

**Only tile layers had loading state management:**
```javascript
// src/essence/Basics/Map_/Map_.js lines 1531-1575
ctx.layerRegistry.layer[layerObj.name].on('loading', () => {
    L_.setGlobalLoading(layerObj.name)
})
ctx.layerRegistry.layer[layerObj.name].on('load', () => {
    L_.setGlobalLoaded(layerObj.name)
})
```

**Vector layers had NO such handlers** - they would trigger loading but never clear it.

## Solution

Added loading state management to the `makeVectorLayer()` function in `src/essence/Basics/Map_/Map_.js`:

### 1. Set loading state when starting fetch (line ~1039)
```javascript
// Set loading state when starting to fetch vector data
if (!isRefresh) {
    L_.setGlobalLoading(layerObj.name)
}
```

### 2. Clear loading state on success (line ~1200)
```javascript
// Clear loading state after vector layer is constructed
if (!isRefresh) {
    L_.setGlobalLoaded(layerObj.name)
}
```

### 3. Clear loading state on error (line ~1128)
```javascript
// Clear loading state on error
if (!isRefresh) {
    L_.setGlobalLoaded(layerObj.name)
}
```

## Testing

After rebuilding the Docker container:

```bash
docker-compose build mmgis
docker-compose up -d
```

Navigate to: `http://localhost:8888/?mission=frozon_ai_forecast`

Toggle the "Vessels (Live AIS)" layer - the loading spinner should now:
1. Appear when the layer is toggled on
2. Disappear once the vessel data loads (typically < 1 second)

## Impact

This fix applies to ALL vector layers that load from URLs, including:
- Vessels (Live AIS) - `/api/vessels/live`
- Aircraft (Live ADS-B) - `/api/aircraft/live`
- Any geodatasets layers - `geodatasets:*`
- Custom GeoJSON endpoints - `api:*`
- External GeoJSON/KML files

## Files Changed

- `src/essence/Basics/Map_/Map_.js` - Added 3 calls to `setGlobalLoaded()` in the vector layer loading path

## Related Components

- **Loading Spinner Control:** `src/essence/Basics/Layers_/Layers_.js` (lines 4080-4098)
- **Vector Data Fetcher:** `src/essence/Basics/Layers_/LayerCapturer.js`
- **Vector Layer Constructor:** `src/essence/Basics/Layers_/LayerConstructors.js`
