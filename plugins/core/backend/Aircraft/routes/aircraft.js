const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { toGeoJSON, trackToGeoJSON } = require("../openskyClient");

function getClient(req) {
  return req.app.locals.openskyClient || null;
}

function parseList(raw) {
  if (!raw) return null;
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * GET /api/aircraft/live
 *
 * Query params (all optional):
 *   bounds=minLon,minLat,maxLon,maxLat   restrict to bbox
 *   countries=US,CA,RU                   country code filter
 *   at=ISO8601                           historical replay: returns each ICAO24's
 *                                        last known position at-or-before this time
 *   windowMinutes=N                      look-back window for `at` (default 60)
 */
router.get("/live", async (req, res) => {
  const client = getClient(req);
  if (!client) {
    return res.status(200).json({
      type: "FeatureCollection",
      features: [],
      _warning: "Aircraft feed disabled (WITH_AIRCRAFT not enabled)",
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
  opts.countries = parseList(req.query.countries);

  // Historical replay branch: pull from PostgreSQL for the requested timestamp
  if (req.query.at) {
    const at = new Date(String(req.query.at));
    if (Number.isNaN(at.getTime())) {
      return res
        .status(400)
        .json({ error: "at must be a valid ISO 8601 timestamp" });
    }
    const nowMs = Date.now();
    // If `at` is effectively "now" (within 2 min of clock), fall through to live cache
    if (Math.abs(at.getTime() - nowMs) > 2 * 60_000) {
      try {
        opts.windowMinutes = Number(req.query.windowMinutes) || undefined;
        const snaps = await client.getHistoricalSnapshot(at, opts);
        // If at-time pre-dates our recorded history (or returns empty), fall back to
        // live cache so the layer never appears mysteriously blank when toggled on
        if (snaps.length === 0) {
          const aircraft = client.getAircraft(opts);
          const fc = toGeoJSON(aircraft);
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

  const aircraft = client.getAircraft(opts);
  res.set("Cache-Control", "public, max-age=15");
  const fc = toGeoJSON(aircraft);
  fc._meta = { mode: "live", count: fc.features.length };
  res.status(200).json(fc);
});

/**
 * GET /api/aircraft/track?icao24=...&hours=24
 *
 * Returns a GeoJSON LineString of the aircraft's recorded positions.
 * Sources, in order: PostgreSQL (durable history) -> in-memory cache.
 */
router.get("/track", async (req, res) => {
  const client = getClient(req);
  const icao24 = String(req.query.icao24 || "").trim().toLowerCase();
  if (!icao24) {
    return res.status(400).json({ error: "icao24 query param required" });
  }
  const hours = Math.max(0.5, Math.min(168, Number(req.query.hours) || 24));
  const since = new Date(Date.now() - hours * 3600 * 1000);

  let snapshot = client ? client.getAircraft(icao24) : null;
  let samples = [];

  // 1. Try PostgreSQL
  const AircraftPosition = req.app.locals.aircraftPositionModel;
  if (AircraftPosition) {
    try {
      const rows = await AircraftPosition.findAll({
        where: { icao24, last_contact: { [Op.gte]: since } },
        order: [["last_contact", "ASC"]],
        attributes: [
          "lon",
          "lat",
          "altitude",
          "velocity",
          "heading",
          "last_contact",
        ],
        limit: 5000,
      });
      samples = rows.map((r) => ({
        lon: r.lon,
        lat: r.lat,
        t: r.last_contact.getTime(),
        altitude: r.altitude,
        velocity: r.velocity,
        heading: r.heading,
      }));
    } catch (err) {
      // Fall through to in-memory
      console.warn("[Aircraft.track] PostgreSQL lookup failed:", err.message);
    }
  }

  // 2. Fall back / supplement from in-memory cache
  if (samples.length < 2 && client) {
    const buf = client.getTrackBuffer(icao24);
    if (buf.length >= samples.length) samples = buf;
  }

  // 3. If still no data, return empty LineString
  if (samples.length === 0) {
    return res.status(200).json({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: [] },
          properties: { icao24, message: "No track data available" },
        },
      ],
    });
  }

  res.set("Cache-Control", "public, max-age=60");
  res.status(200).json(trackToGeoJSON(samples));
});

/**
 * GET /api/aircraft/status
 *
 * Returns diagnostics about the OpenSky client
 */
router.get("/status", (req, res) => {
  const client = getClient(req);
  if (!client) {
    return res.status(200).json({
      enabled: false,
      message: "Aircraft tracking disabled (WITH_AIRCRAFT not set)",
    });
  }

  const status = client.getStatus();
  res.status(200).json({
    enabled: true,
    ...status,
  });
});

module.exports = router;
