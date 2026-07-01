/**
 * Sample the daily AI sea-ice forecast COG at vessel positions.
 *
 * The forecast TIFs (Missions/frozon/Layers/forecast-7day-PRED/NSIDC_SICONC_AI_PRED_YYYYMMDD.tif)
 * are 512x512 EPSG:3413 polar stereographic rasters with values 0.0–1.0
 * (sea-ice fraction). Nodata = -9999 (typically land).
 *
 * Strategy: open the file once, transform each WGS84 (lon,lat) to EPSG:3413
 * meters via proj4, map (x,y) to pixel index, look up value. ~3000 lookups
 * is sub-second (no per-point HTTP).
 */

const fs = require("fs");
const path = require("path");
const proj4 = require("proj4");

let _geotiffPromise = null;
function loadGeotiff() {
  if (!_geotiffPromise) {
    // geotiff@2.x is ESM-only; load via dynamic import which works under both
    // older node (which can't require() ESM) and node 20+.
    _geotiffPromise = import("geotiff");
  }
  return _geotiffPromise;
}

// EPSG:3413 — NSIDC Sea Ice Polar Stereographic North
proj4.defs(
  "EPSG:3413",
  "+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
);
const projWgsTo3413 = proj4("EPSG:4326", "EPSG:3413");

const FORECAST_DIR_DEFAULT = path.join(
  process.cwd(),
  "Missions",
  "frozon",
  "Layers",
  "forecast-7day-PRED"
);
const FORECAST_PATTERN = /^NSIDC_SICONC_AI_PRED_(\d{8})\.tif$/;

let cachedRaster = null;

function listAvailableDates(dir = FORECAST_DIR_DEFAULT) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .map((name) => {
      const m = name.match(FORECAST_PATTERN);
      return m ? m[1] : null;
    })
    .filter(Boolean)
    .sort();
}

function resolveTifPath(date, dir = FORECAST_DIR_DEFAULT) {
  if (!date) {
    const dates = listAvailableDates(dir);
    if (dates.length === 0) return null;
    date = dates[dates.length - 1]; // latest available
  }
  const compact = String(date).replace(/-/g, "");
  const fname = `NSIDC_SICONC_AI_PRED_${compact}.tif`;
  const full = path.join(dir, fname);
  if (!fs.existsSync(full)) return null;
  return { path: full, date: compact };
}

async function loadRaster(filePath) {
  if (cachedRaster && cachedRaster.path === filePath) return cachedRaster;
  const geotiff = await loadGeotiff();
  const tiff = await geotiff.fromFile(filePath);
  const image = await tiff.getImage();
  const [data] = await image.readRasters();
  const bbox = image.getBoundingBox();
  const width = image.getWidth();
  const height = image.getHeight();
  const noData = image.getGDALNoData();
  cachedRaster = {
    path: filePath,
    data,
    width,
    height,
    bbox,
    noData: noData != null ? noData : -9999,
    pxX: (bbox[2] - bbox[0]) / width,
    pxY: (bbox[3] - bbox[1]) / height,
  };
  return cachedRaster;
}

/**
 * Sample the raster at WGS84 lon/lat.
 * @returns {number|null} sea-ice fraction 0..1, or null if outside grid / nodata.
 */
function sampleAt(raster, lon, lat) {
  const [x, y] = projWgsTo3413.forward([lon, lat]);
  if (x < raster.bbox[0] || x > raster.bbox[2]) return null;
  if (y < raster.bbox[1] || y > raster.bbox[3]) return null;
  const col = Math.min(
    raster.width - 1,
    Math.max(0, Math.floor((x - raster.bbox[0]) / raster.pxX))
  );
  const row = Math.min(
    raster.height - 1,
    Math.max(0, Math.floor((raster.bbox[3] - y) / raster.pxY))
  );
  const v = raster.data[row * raster.width + col];
  if (v === raster.noData || !Number.isFinite(v)) return null;
  // Sea-ice fraction must be in [0, 1]. Anything else (e.g. -9999 land,
  // intermediate negative values from upstream resampling artifacts) is invalid.
  if (v < 0 || v > 1) return null;
  return v;
}

/**
 * Filter the cached vessel list to those at or above a sea-ice threshold (0..1).
 * @param {Array<object>} vessels — output of AisStreamClient.getVessels()
 * @param {object} opts
 * @param {number} opts.thresholdFraction 0..1 (e.g. 0.8 for 80%)
 * @param {string} [opts.date] YYYYMMDD or YYYY-MM-DD; defaults to most recent available
 * @returns {Promise<{date:string,thresholdFraction:number,vessels:Array<object>}>}
 */
async function vesselsInIce(vessels, opts) {
  const thresholdFraction = Number(opts?.thresholdFraction);
  if (!Number.isFinite(thresholdFraction)) {
    throw new Error("thresholdFraction (0..1) required");
  }
  const resolved = resolveTifPath(opts?.date);
  if (!resolved) {
    throw new Error(
      `No forecast TIF found${opts?.date ? ` for date ${opts.date}` : ""}`
    );
  }
  const raster = await loadRaster(resolved.path);
  const matched = [];
  for (const v of vessels) {
    const value = sampleAt(raster, v.lon, v.lat);
    if (value == null) continue;
    if (value >= thresholdFraction) {
      matched.push({ ...v, _iceFraction: value });
    }
  }
  return {
    date: resolved.date,
    thresholdFraction,
    raster: { width: raster.width, height: raster.height, bbox: raster.bbox },
    vessels: matched,
  };
}

module.exports = {
  vesselsInIce,
  listAvailableDates,
  resolveTifPath,
  sampleAt,
  loadRaster,
};
