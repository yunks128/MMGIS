# Frozon Layer Data & Configuration Locations

## 1. Mission Configuration (Database)

**Database**: PostgreSQL container `mmgis-db-1`, database `name`
**Table**: `configs`
**Current version**: 46 (as of 2026-04-30)

**Query to get current config**:
```sql
SELECT config FROM configs 
WHERE mission = 'frozon_ai_forecast' 
ORDER BY version DESC LIMIT 1;
```

**Access via API**: 
- `GET http://localhost:8889/api/configure/get?mission=frozon_ai_forecast`

**Key configuration fields** (in JSON `config` column):
- `layers[]` - array of layer definitions
- Each layer has: `name`, `type`, `url`, `sourceType`, `visibility`, etc.

## 2. Layer Data Files (Filesystem)

**Host Path**: `Missions/frozon/Layers/`
**Container Path**: `/usr/src/app/Missions/frozon/Layers/` (bind-mounted)

### Three forecast collections:

1. **PRED (Prediction)**
   - Directory: `forecast-7day-PRED/`
   - Files: 728 TIFFs
   - Pattern: `NSIDC_SICONC_AI_PRED_YYYYMMDD.tif`
   - Date range: 2023-01-04 to 2024-12-31

2. **GRND (Ground Truth)**
   - Directory: `forecast-7day-GRND/`
   - Files: 729 TIFFs
   - Pattern: `NSIDC_SICONC_AI_GRND_YYYYMMDD.tif`
   - Date range: 2023-01-03 to 2024-12-31

3. **DIFF (Difference)**
   - Directory: `forecast-7day-DIFF/`
   - Files: 728 TIFFs
   - Pattern: `NSIDC_SICONC_AI_DIFF_YYYYMMDD.tif`
   - Date range: 2023-01-04 to 2024-12-31

## 3. STAC Metadata (Database)

**Database**: PostgreSQL container `mmgis-db-1`, database `mmgis-stac`
**Schema**: `pgstac`
**Tables**:
- `collections` - 3 collections (PRED, GRND, DIFF)
- `items` - 2,185 total items (728 + 729 + 728)

**Query collections**:
```sql
SELECT id, content->>'title' 
FROM pgstac.collections;
```

**Access via API**:
- Collections: `http://localhost:8881/collections/forecast-7day-PRED`
- Items: `http://localhost:8881/collections/forecast-7day-PRED/items?limit=10`

## 4. Runtime Services

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| MMGIS App | `mmgis-mmgis-1` | 8889 | Main application |
| STAC API | `mmgis-stac-api` | 8881 | Serves STAC metadata |
| TiTiler | `mmgis-titiler-pgstac` | 8884 | Renders tiles from STAC items |

**Network Requirements**:
- STAC container needs alias `stac-fastapi` on `mmgis_default` network
- TiTiler container needs alias `titiler-pgstac` on `mmgis_default` network

**Tile URL pattern** (accessed via MMGIS proxy):
```
http://localhost:8889/titilerpgstac/stac/collections/{collection_id}/tilejson.json
```

## 5. How Layers Work (Data Flow)

1. **Frontend** requests layer tiles for a specific date
2. **MMGIS proxy** (`adjacent-servers-proxy.js`) forwards to TiTiler at `http://titiler-pgstac:8884`
3. **TiTiler** queries **STAC API** at `http://stac-fastapi:8881` for items matching date
4. **STAC API** queries **pgstac database** for metadata
5. **TiTiler** reads the **TIF file** from bind-mounted filesystem
6. **TiTiler** renders tile with colormap/expression and returns PNG to browser

## 6. Configuration Management

**IMPORTANT**: Never UPDATE configs in place. Always INSERT new version:

```sql
-- Get current config
SELECT config FROM configs 
WHERE mission = 'frozon_ai_forecast' 
ORDER BY version DESC LIMIT 1;

-- Insert new version (version auto-increments)
INSERT INTO configs (mission, config, version, "createdAt")
SELECT 'frozon_ai_forecast', 
       '{ ... new config JSON ... }'::json,
       MAX(version) + 1,
       NOW()
FROM configs 
WHERE mission = 'frozon_ai_forecast';
```

Or use the Configure UI: `http://localhost:8889/configure`

## 7. Layer Configuration Example

The PRED layer in the current config (v46):

```json
{
  "url": "forecast-7day-PRED",
  "name": "SFNO Prediction Daily 10 km 2022-2024",
  "type": "tile",
  "sourceType": "stac-collection",
  "visibility": true,
  "time": {
    "enabled": true,
    "type": "requery"
  },
  "cogExpression": "(asset_b1*100)",
  "cogColormap": "cmrmap",
  "cogMin": 0,
  "cogMax": 100,
  "cogUnits": "%",
  "initialOpacity": 1
}
```

**Key fields**:
- `url`: STAC collection ID
- `sourceType`: "stac-collection" (not "url")
- `time.enabled`: true = requires date selection
- `cogExpression`: transforms 0-1 values to 0-100 percent
- `cogColormap`: matplotlib colormap name
- `cogMin/cogMax`: scale range for colormap

## 8. Troubleshooting

**Layer not showing?**
1. Check date is within data range (2023-01-04 to 2024-12-31)
2. Verify STAC containers are running: `docker ps | grep stac`
3. Check network aliases: `docker inspect mmgis-stac-api | grep Aliases`
4. Test STAC API: `curl http://localhost:8881/collections`
5. Check browser console for tile request errors

**Update not showing?**
1. After config changes: restart MMGIS container
2. After frontend changes: hard refresh browser (Cmd+Shift+R)
3. Check current version: `SELECT MAX(version) FROM configs WHERE mission='frozon_ai_forecast'`
