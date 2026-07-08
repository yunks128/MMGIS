/**
 * Aircraft plugin: real-time ADS-B aircraft positions via OpenSky Network API.
 *
 * Mounts:
 *   GET /api/aircraft/live               — GeoJSON FeatureCollection (with ?bounds, ?countries)
 *   GET /api/aircraft/track?icao24=...   — GeoJSON LineString of historical positions
 *   GET /api/aircraft/status             — diagnostics
 *
 * Env:
 *   WITH_AIRCRAFT=true            (required to enable feed)
 *   OPENSKY_BBOX_LAMIN            (optional, default 66.5 - Arctic Circle)
 *   OPENSKY_BBOX_LOMIN            (optional, default -180)
 *   OPENSKY_BBOX_LAMAX            (optional, default 90 - North Pole)
 *   OPENSKY_BBOX_LOMAX            (optional, default 180)
 *   OPENSKY_POLL_INTERVAL         (optional, default 30000ms - 30 seconds)
 *   OPENSKY_TTL_MINUTES           (in-memory cache TTL, default 60)
 *   AIRCRAFT_HISTORY_DAYS         (PostgreSQL retention, default 7; 0 disables persistence)
 */

const router = require("./routes/aircraft");
const { Op } = require("sequelize");
const { OpenSkyClient } = require("./openskyClient");
const AircraftPosition = require("./models/aircraftPosition");

let client = null;
let cleanupTimer = null;

const setup = {
  envs: [
    {
      name: "WITH_AIRCRAFT",
      description:
        "Enable aircraft tracking via OpenSky Network API. Set to 'true' to activate.",
      required: false,
    },
    {
      name: "OPENSKY_BBOX_LAMIN",
      description:
        "Minimum latitude for OpenSky bounding box query. Default 66.5 (Arctic Circle).",
      required: false,
    },
    {
      name: "OPENSKY_BBOX_LOMIN",
      description:
        "Minimum longitude for OpenSky bounding box query. Default -180.",
      required: false,
    },
    {
      name: "OPENSKY_BBOX_LAMAX",
      description:
        "Maximum latitude for OpenSky bounding box query. Default 90 (North Pole).",
      required: false,
    },
    {
      name: "OPENSKY_BBOX_LOMAX",
      description:
        "Maximum longitude for OpenSky bounding box query. Default 180.",
      required: false,
    },
    {
      name: "OPENSKY_POLL_INTERVAL",
      description:
        "Polling interval in milliseconds. Default 30000 (30 seconds). Without OPENSKY_CLIENT_ID/OPENSKY_CLIENT_SECRET this is clamped to 900000 (15 minutes) to stay within OpenSky's anonymous daily quota.",
      required: false,
    },
    {
      name: "OPENSKY_CLIENT_ID",
      description:
        "OAuth2 client id from an OpenSky Network account (opensky-network.org). Optional; grants a much higher API quota than anonymous access.",
      required: false,
    },
    {
      name: "OPENSKY_CLIENT_SECRET",
      description:
        "OAuth2 client secret paired with OPENSKY_CLIENT_ID.",
      required: false,
    },
    {
      name: "OPENSKY_TTL_MINUTES",
      description:
        "In-memory cache TTL for aircraft positions. Default 60 minutes.",
      required: false,
    },
    {
      name: "AIRCRAFT_HISTORY_DAYS",
      description:
        "Days of position history to retain in PostgreSQL for /api/aircraft/track. Default 7. Set to 0 to disable persistence.",
      required: false,
    },
  ],

  onceInit: (s) => {
    // Only mount routes if WITH_AIRCRAFT is enabled
    const enabled = process.env.WITH_AIRCRAFT === "true";
    if (!enabled) {
      console.log(
        "[Aircraft] Plugin disabled. Set WITH_AIRCRAFT=true to enable."
      );
      return;
    }

    s.app.use(
      s.ROOT_PATH + "/api/aircraft",
      s.checkHeadersCodeInjection,
      s.setContentType,
      router
    );
    console.log("[Aircraft] Routes mounted at /api/aircraft");
  },

  onceStarted: (s) => {
    const enabled = process.env.WITH_AIRCRAFT === "true";
    if (!enabled) return;

    const bbox = {
      lamin: Number(process.env.OPENSKY_BBOX_LAMIN) || 66.5,
      lomin: Number(process.env.OPENSKY_BBOX_LOMIN) || -180,
      lamax: Number(process.env.OPENSKY_BBOX_LAMAX) || 90,
      lomax: Number(process.env.OPENSKY_BBOX_LOMAX) || 180,
    };
    const pollIntervalMs = Number(process.env.OPENSKY_POLL_INTERVAL) || 30000;
    const ttlMin = Number(process.env.OPENSKY_TTL_MINUTES) || 60;
    const historyDays =
      process.env.AIRCRAFT_HISTORY_DAYS != null
        ? Number(process.env.AIRCRAFT_HISTORY_DAYS)
        : 7;

    // Wire persistence only if history is enabled
    const persistEnabled = historyDays > 0;
    const onPositionPersist = persistEnabled
      ? async (batch) => {
          // Batched bulk insert
          const rows = batch.map((a) => ({
            icao24: a.icao24,
            callsign: a.callsign,
            origin_country: a.origin_country,
            lon: a.lon,
            lat: a.lat,
            altitude: a.altitude,
            velocity: a.velocity,
            heading: a.heading,
            vertical_rate: a.vertical_rate,
            on_ground: a.on_ground,
            last_contact: a.last_contact,
          }));
          await AircraftPosition.bulkCreate(rows, {
            updateOnDuplicate: [
              "callsign",
              "origin_country",
              "lon",
              "lat",
              "altitude",
              "velocity",
              "heading",
              "vertical_rate",
              "on_ground",
              "last_contact",
              "updated_at",
            ],
          });
        }
      : null;

    client = new OpenSkyClient({
      bbox,
      pollIntervalMs,
      ttlMs: ttlMin * 60 * 1000,
      logger: console,
      onPositionPersist,
      AircraftPosition: persistEnabled ? AircraftPosition : null,
      clientId: process.env.OPENSKY_CLIENT_ID || null,
      clientSecret: process.env.OPENSKY_CLIENT_SECRET || null,
    });

    s.app.locals.openskyClient = client;
    s.app.locals.aircraftPositionModel = AircraftPosition;
    client.start();

    // Background cleanup of old position rows
    if (persistEnabled) {
      cleanupTimer = setInterval(
        async () => {
          try {
            const cutoff = new Date(
              Date.now() - historyDays * 24 * 3600 * 1000
            );
            const removed = await AircraftPosition.destroy({
              where: { last_contact: { [Op.lt]: cutoff } },
            });
            if (removed > 0) {
              console.log(
                `[Aircraft] Cleanup: removed ${removed} positions older than ${historyDays}d`
              );
            }
          } catch (err) {
            console.warn("[Aircraft] Cleanup failed:", err.message);
          }
        },
        30 * 60 * 1000
      ); // every 30 min
      if (cleanupTimer.unref) cleanupTimer.unref();
    }
  },

  onceSynced: async (_s) => {
    const enabled = process.env.WITH_AIRCRAFT === "true";
    if (!enabled) return;

    try {
      await AircraftPosition.sync();
      console.log("[Aircraft] aircraft_positions table synced");
    } catch (err) {
      console.warn(
        "[Aircraft] Failed to sync aircraft_positions:",
        err.message
      );
    }
  },
};

module.exports = setup;
