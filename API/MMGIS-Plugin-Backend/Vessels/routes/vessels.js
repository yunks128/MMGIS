const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { toGeoJSON, trackToGeoJSON } = require("../aisstreamClient");
const { vesselsInIce, listAvailableDates } = require("../iceSampler");

function getClient(req) {
  return req.app.locals.aisstreamClient || null;
}

function parseList(raw) {
  if (!raw) return null;
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * GET /api/vessels/live
 *
 * Query params (all optional):
 *   bounds=minLon,minLat,maxLon,maxLat   restrict to bbox
 *   types=Cargo,Tanker                   case-insensitive substring match against shipTypeText
 *   flags=NO,RU,US                       ISO2 country code filter (from MMSI MID)
 *   at=ISO8601                           historical replay: returns each MMSI's
 *                                        last known position at-or-before this time
 *   windowMinutes=N                      look-back window for `at` (default 60)
 */
router.get("/live", async (req, res) => {
  const client = getClient(req);
  if (!client) {
    return res.status(200).json({
      type: "FeatureCollection",
      features: [],
      _warning: "Vessel feed disabled (no AISSTREAM_API_KEY)",
    });
  }

  const opts = {};
  if (req.query.bounds) {
    const parts = String(req.query.bounds).split(",").map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      opts.bbox = parts;
    } else {
      return res
        .status(400)
        .json({ error: "bounds must be minLon,minLat,maxLon,maxLat" });
    }
  }
  opts.types = parseList(req.query.types);
  opts.flags = parseList(req.query.flags);

  // Historical replay branch: pull from PostGIS for the requested timestamp.
  if (req.query.at) {
    const at = new Date(String(req.query.at));
    if (Number.isNaN(at.getTime())) {
      return res.status(400).json({ error: "at must be a valid ISO 8601 timestamp" });
    }
    const nowMs = Date.now();
    // If `at` is effectively "now" (within 2 min of clock), fall through to live cache.
    if (Math.abs(at.getTime() - nowMs) > 2 * 60_000) {
      try {
        opts.windowMinutes = Number(req.query.windowMinutes) || undefined;
        const snaps = await client.getHistoricalSnapshot(at, opts);
        // If at-time pre-dates our recorded history (or returns empty), fall back to
        // live cache so the layer never appears mysteriously blank when toggled on.
        if (snaps.length === 0) {
          const vessels = client.getVessels(opts);
          const fc = toGeoJSON(vessels);
          fc._meta = {
            mode: "live-fallback",
            requestedAt: at.toISOString(),
            reason: "no recorded positions in window; showing live cache",
            count: fc.features.length,
          };
          res.set("Cache-Control", "public, max-age=15");
          return res.status(200).json(fc);
        }
        const fc = toGeoJSON(snaps);
        fc._meta = {
          mode: "historical",
          at: at.toISOString(),
          windowMinutes: opts.windowMinutes || 60,
          count: fc.features.length,
        };
        res.set("Cache-Control", "public, max-age=60");
        return res.status(200).json(fc);
      } catch (err) {
        return res
          .status(500)
          .json({ error: "Historical query failed: " + err.message });
      }
    }
  }

  const vessels = client.getVessels(opts);
  res.set("Cache-Control", "public, max-age=15");
  const fc = toGeoJSON(vessels);
  fc._meta = { mode: "live", count: fc.features.length };
  res.status(200).json(fc);
});

/**
 * GET /api/vessels/track?mmsi=...&hours=24
 *
 * Returns a GeoJSON LineString of the vessel's recorded positions.
 * Sources, in order: PostGIS (durable history) -> in-memory ring buffer.
 */
router.get("/track", async (req, res) => {
  const client = getClient(req);
  const mmsi = String(req.query.mmsi || "").trim();
  if (!mmsi) {
    return res.status(400).json({ error: "mmsi query param required" });
  }
  const hours = Math.max(0.5, Math.min(168, Number(req.query.hours) || 24));
  const since = new Date(Date.now() - hours * 3600 * 1000);

  let snapshot = client ? client.getVessel(mmsi) : null;
  let samples = [];

  // 1. Try PostGIS
  const VesselPosition = req.app.locals.vesselPositionModel;
  if (VesselPosition) {
    try {
      const rows = await VesselPosition.findAll({
        where: { mmsi, tUtc: { [Op.gte]: since } },
        order: [["tUtc", "ASC"]],
        attributes: ["lon", "lat", "speed", "course", "tUtc"],
        limit: 5000,
      });
      samples = rows.map((r) => ({
        lon: r.lon,
        lat: r.lat,
        t: r.tUtc.getTime(),
        sog: r.speed,
        cog: r.course,
      }));
    } catch (err) {
      // Fall through to in-memory
      console.warn("[Vessels.track] PostGIS lookup failed:", err.message);
    }
  }

  // 2. Fall back / supplement from in-memory buffer
  if (samples.length < 2 && client) {
    const buf = client.getTrackBuffer(mmsi);
    if (buf.length >= samples.length) samples = buf;
  }

  if (samples.length < 2) {
    return res.status(200).json({
      type: "FeatureCollection",
      features: [],
      _info: "Track unavailable: insufficient position history yet (vessel must move and remain in feed for some time).",
      mmsi,
      hours,
      pointCount: samples.length,
    });
  }

  const fc = trackToGeoJSON(mmsi, samples, snapshot);
  res.set("Cache-Control", "no-store");
  res.status(200).json(fc);
});

/**
 * GET /api/vessels/in-ice
 *
 * Query:
 *   threshold     percent 0..100 (default 80)
 *   date          YYYYMMDD or YYYY-MM-DD (default = most recent available TIF)
 *   bounds, types, flags — same as /live
 *
 * Returns vessels currently located in raster pixels with sea-ice fraction
 * >= threshold/100, based on the day's `forecast-7day-PRED` COG.
 */
router.get("/in-ice", async (req, res) => {
  const client = getClient(req);
  if (!client) {
    return res.status(200).json({
      type: "FeatureCollection",
      features: [],
      _warning: "Vessel feed disabled",
    });
  }
  const thresholdPercent = req.query.threshold != null
    ? Number(req.query.threshold)
    : 80;
  if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0 || thresholdPercent > 100) {
    return res.status(400).json({ error: "threshold must be 0..100" });
  }

  const opts = {};
  if (req.query.bounds) {
    const parts = String(req.query.bounds).split(",").map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) opts.bbox = parts;
  }
  opts.types = parseList(req.query.types);
  opts.flags = parseList(req.query.flags);

  const vessels = client.getVessels(opts);
  try {
    const result = await vesselsInIce(vessels, {
      thresholdFraction: thresholdPercent / 100,
      date: req.query.date,
    });
    const fc = toGeoJSON(result.vessels);
    fc._meta = {
      forecastDate: result.date,
      thresholdPercent,
      vesselsTotal: vessels.length,
      vesselsInIce: result.vessels.length,
    };
    res.set("Cache-Control", "public, max-age=60");
    res.status(200).json(fc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/vessels/forecast-dates
 * List of dates (YYYYMMDD) for which a forecast TIF is available.
 */
router.get("/forecast-dates", (_req, res) => {
  res.status(200).json({ dates: listAvailableDates() });
});

/**
 * GET /api/vessels/status — diagnostics.
 */
router.get("/status", (req, res) => {
  const client = getClient(req);
  if (!client) {
    return res.status(200).json({ status: "disabled" });
  }
  res.status(200).json(client.status_());
});

module.exports = router;
