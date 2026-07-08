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

// Split a coordinate run wherever it jumps the antimeridian so trails don't
// draw horizontal lines across the whole map
function splitAtAntimeridian(coords) {
  const segments = [];
  let current = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    if (Math.abs(coords[i][0] - coords[i - 1][0]) > 180) {
      if (current.length > 1) segments.push(current);
      current = [coords[i]];
    } else {
      current.push(coords[i]);
    }
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

/**
 * Build one MultiLineString trail feature per aircraft from recorded positions.
 * Returned features carry per-feature `properties.style` so the frontend
 * renders them as translucent trails without any layer-config changes.
 */
async function buildTrailFeatures(AircraftPosition, aircraft, hours) {
  if (!AircraftPosition || aircraft.length === 0) return [];
  const { Op } = require("sequelize");
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const icaos = aircraft.map((a) => a.icao24);

  const rows = await AircraftPosition.findAll({
    where: { icao24: { [Op.in]: icaos }, last_contact: { [Op.gte]: since } },
    order: [
      ["icao24", "ASC"],
      ["last_contact", "ASC"],
    ],
    attributes: ["icao24", "lon", "lat"],
    limit: 100000,
    raw: true,
  });

  const byIcao = new Map();
  for (const r of rows) {
    if (!byIcao.has(r.icao24)) byIcao.set(r.icao24, []);
    byIcao.get(r.icao24).push([r.lon, r.lat]);
  }

  const infoByIcao = new Map(aircraft.map((a) => [a.icao24, a]));
  const features = [];
  for (const [icao24, coords] of byIcao) {
    if (coords.length < 2) continue;
    const segments = splitAtAntimeridian(coords);
    if (segments.length === 0) continue;
    const a = infoByIcao.get(icao24) || {};
    const label = a.callsign || icao24;
    features.push({
      type: "Feature",
      geometry: { type: "MultiLineString", coordinates: segments },
      // noclick: trails shouldn't hijack clicks meant for the aircraft marker
      style: { noclick: true },
      properties: {
        displayName: `${label} (${hours}h track)`,
        icao24,
        origin_country: a.origin_country || null,
        _trail: true,
        style: {
          color: "#3b82f6",
          weight: 2,
          opacity: 0.55,
          fillOpacity: 0,
        },
      },
    });
  }
  return features;
}

// Attach trails to a FeatureCollection when ?tracks=true. `aircraft` is the
// list whose ids the trails should cover.
async function maybeAttachTrails(req, fc, aircraft) {
  if (req.query.tracks !== "true") return;
  const hours = Math.max(1, Math.min(168, Number(req.query.trackHours) || 24));
  try {
    const trails = await buildTrailFeatures(
      req.app.locals.aircraftPositionModel,
      aircraft,
      hours
    );
    // Trails first so point markers draw on top of them
    fc.features = trails.concat(fc.features);
    fc._meta = fc._meta || {};
    fc._meta.trails = trails.length;
    fc._meta.trackHours = hours;
  } catch (err) {
    console.warn("[Aircraft.live] Trail build failed:", err.message);
  }
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

  // Live cache is empty (server restart, or OpenSky rate-limiting us):
  // fall back to the most recent recorded positions so the layer isn't blank
  if (aircraft.length === 0 && req.app.locals.aircraftPositionModel) {
    try {
      const snaps = await client.getHistoricalSnapshot(new Date(), {
        ...opts,
        windowMinutes: 24 * 60,
      });
      if (snaps.length > 0) {
        const fc = toGeoJSON(snaps);
        fc._meta = {
          mode: "db-fallback",
          reason:
            "live cache empty; showing last recorded positions (up to 24h old)",
          count: fc.features.length,
        };
        await maybeAttachTrails(req, fc, snaps);
        res.set("Cache-Control", "public, max-age=60");
        return res.status(200).json(fc);
      }
    } catch (err) {
      console.warn("[Aircraft.live] DB fallback failed:", err.message);
    }
  }

  res.set("Cache-Control", "public, max-age=15");
  const fc = toGeoJSON(aircraft);
  fc._meta = { mode: "live", count: fc.features.length };
  await maybeAttachTrails(req, fc, aircraft);
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
