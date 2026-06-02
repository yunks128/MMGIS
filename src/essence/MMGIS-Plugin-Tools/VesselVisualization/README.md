# MMGIS Vessel Visualization Plugin (Frontend)

Rich vessel popups and track visualization for live AIS data.

## Overview

This frontend plugin enhances the vessel layer with:

- **Rich popups** showing vessel name, MMSI, flag, speed, course, heading, nav status, and more
- **External links** to MarineTraffic and VesselFinder for each vessel
- **Auto-draw tracks** when clicking on a vessel (fetches last 24 hours from `/api/vessels/track`)
- **Idempotent popup binding** that survives layer refresh and time slider changes

## Features

- Automatic popup attachment to vessel markers
- Periodic rebinding (every 2 seconds) to handle MMGIS auto-refresh
- Click-to-track functionality with animated polyline
- Styled popups with vessel metadata
- Responsive to layer toggle and time slider events

## Integration

This plugin works with the **Vessels** backend plugin at `API/MMGIS-Plugin-Backend/Vessels/`.

### Prerequisites

1. Backend plugin must be enabled (`WITH_VESSELS=true` in `.env`)
2. AISStream.io API key configured
3. Vessel layer added to mission config (see below)

## Layer Configuration

Your mission config must include a vessel layer named `"Vessels (Live AIS)"`:

```json
{
  "name": "Vessels (Live AIS)",
  "type": "vector",
  "url": "/api/vessels/live",
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
  }
}
```

## How It Works

### Popup Binding

The plugin automatically binds rich HTML popups to vessel markers:

1. On page load, `installVesselClickTrackHandler()` is called after 3-second delay
2. `rebindVesselPopups()` runs immediately and then every 2 seconds
3. Each vessel marker gets a popup with metadata from `feature.properties`
4. Popups include external links to MarineTraffic and VesselFinder

### Track Drawing

When a user clicks a vessel:

1. Click handler detects vessel MMSI from `feature.properties`
2. Fetches track data from `/api/vessels/track?mmsi=...`
3. Draws red dashed polyline on map
4. Adds marker at current position
5. Fits map bounds to track extent

### Event Subscriptions

The plugin subscribes to:

- **Layer toggle events:** Rebind popups when vessel layer is enabled
- **Time layer reload events:** Rebind popups after time slider changes
- **Periodic timer:** Rebind every 2 seconds to handle auto-refresh

## Popup Fields

Each popup displays:

- **Name:** Vessel name from AIS ShipStaticData
- **MMSI:** Maritime Mobile Service Identity (9-digit ID)
- **IMO:** International Maritime Organization number
- **Callsign:** Radio callsign
- **Status:** Navigational status (e.g., "Under way using engine", "At anchor")
- **Speed:** Speed over ground in knots
- **Course:** Course over ground in degrees
- **Heading:** True heading in degrees
- **Destination:** Reported destination port
- **Dimensions:** Vessel length × width (meters)
- **Draught:** Vessel draught in meters
- **Position:** Current lat/lon coordinates
- **Last report:** Time since last AIS message
- **External links:** MarineTraffic and VesselFinder

## File Structure

```
src/essence/MMGIS-Plugin-Tools/VesselVisualization/
├── VesselVisualization.js      # Main plugin code
└── README.md                   # This file
```

## API Reference

### Exported Functions

#### `rebindVesselPopups()`

Binds rich HTML popups to all vessel markers. Idempotent — safe to call repeatedly.

**Returns:** Number of markers with popups bound

#### `drawVesselTrack(mmsi, hours = 24)`

Fetches and draws historical track for one vessel.

**Parameters:**
- `mmsi` — Maritime Mobile Service Identity (string)
- `hours` — Number of hours of history to fetch (default 24)

**Returns:** Promise that resolves when track is drawn

#### `installVesselClickTrackHandler()`

Installs the global click handler and popup binding system. Called automatically on page load.

#### `buildVesselPopupHTML(properties)`

Builds rich HTML popup content from vessel feature properties.

**Parameters:**
- `properties` — GeoJSON feature properties object

**Returns:** HTML string

## Development

To test the plugin during development:

1. Ensure backend plugin is running
2. Add vessel layer to your mission config
3. Open browser console to see debug logs
4. Toggle vessel layer on
5. Click any vessel to see popup and track

## Notes

- The 2-second rebind interval is necessary because MMGIS auto-refreshes vector layers every 30 seconds, which destroys and recreates all markers
- `rebindVesselPopups()` is idempotent — it only updates popups that don't already exist
- The 3-second delay before initial install prevents interference with MMGIS bootstrap
- Layer name must be exactly `"Vessels (Live AIS)"` or the plugin won't find it

## References

- **Backend plugin:** `API/MMGIS-Plugin-Backend/Vessels/`
- **API documentation:** `/docs/vessel-tracking-integration.md`
- **Code map:** `/VESSEL-TRACKING-CODE-MAP.md`
