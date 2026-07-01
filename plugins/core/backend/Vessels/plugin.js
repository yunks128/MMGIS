/**
 * Vessels plugin: real-time AIS ship positions via AISStream.io.
 *
 * Mounts:
 *   GET /api/vessels/live            — GeoJSON FeatureCollection (with ?bounds, ?types, ?flags)
 *   GET /api/vessels/track?mmsi=...  — GeoJSON LineString of historical positions
 *   GET /api/vessels/in-ice          — vessels currently in ≥N% ice (cross-references PRED COG)
 *   GET /api/vessels/forecast-dates  — list of available forecast YYYYMMDD dates
 *   GET /api/vessels/status          — diagnostics
 *
 * Env:
 *   AISSTREAM_API_KEY         (required to enable feed)
 *   AISSTREAM_BBOX            (optional JSON, default Arctic [[[60,-180],[90,180]]])
 *   AISSTREAM_TTL_MINUTES     (in-memory cache TTL, default 60)
 *   VESSEL_HISTORY_DAYS       (PostGIS retention, default 7; 0 disables persistence)
 */

const router = require("./routes/vessels");
const { Op } = require("sequelize");
const { AisStreamClient } = require("./aisstreamClient");
const VesselPosition = require("./models/vesselPosition");

let client = null;
let cleanupTimer = null;

function parseBoundingBoxes(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch (e) {
    console.warn(
      "[Vessels] AISSTREAM_BBOX could not be parsed as JSON; using default. " +
        e.message
    );
  }
  return null;
}

const setup = {
  envs: [
    {
      name: "AISSTREAM_API_KEY",
      description:
        "AISStream.io API key (https://aisstream.io). Free, instant. Without it the vessel feed is disabled.",
      required: false,
    },
    {
      name: "AISSTREAM_BBOX",
      description:
        "Optional JSON of [[lat,lon],[lat,lon]] bounding boxes. Default Arctic [[[60,-180],[90,180]]].",
      required: false,
    },
    {
      name: "AISSTREAM_TTL_MINUTES",
      description:
        "In-memory cache TTL for vessel positions. Default 60.",
      required: false,
    },
    {
      name: "VESSEL_HISTORY_DAYS",
      description:
        "Days of position history to retain in PostGIS for /api/vessels/track. Default 7. Set to 0 to disable persistence.",
      required: false,
    },
  ],

  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/vessels",
      s.checkHeadersCodeInjection,
      s.setContentType,
      router
    );
  },

  onceStarted: (s) => {
    const apiKey = process.env.AISSTREAM_API_KEY || "";
    const ttlMin = Number(process.env.AISSTREAM_TTL_MINUTES) || 60;
    const historyDays = process.env.VESSEL_HISTORY_DAYS != null
      ? Number(process.env.VESSEL_HISTORY_DAYS)
      : 7;
    const boundingBoxes = parseBoundingBoxes(process.env.AISSTREAM_BBOX);

    // Wire persistence only if history is enabled. _flushPersistQueue uses this.
    const persistEnabled = historyDays > 0;
    const onPositionPersist = persistEnabled
      ? async (batch) => {
          // Batched bulk insert; ignoreDuplicates protects against rare retransmits
          await VesselPosition.bulkCreate(batch);
        }
      : null;

    client = new AisStreamClient({
      apiKey,
      boundingBoxes,
      ttlMs: ttlMin * 60 * 1000,
      logger: console,
      onPositionPersist,
      VesselPosition: persistEnabled ? VesselPosition : null,
    });
    s.app.locals.aisstreamClient = client;
    s.app.locals.vesselPositionModel = VesselPosition;
    client.start();

    // Background cleanup of old position rows
    if (persistEnabled) {
      cleanupTimer = setInterval(async () => {
        try {
          const cutoff = new Date(
            Date.now() - historyDays * 24 * 3600 * 1000
          );
          const removed = await VesselPosition.destroy({
            where: { tUtc: { [Op.lt]: cutoff } },
          });
          if (removed > 0) {
            console.log(
              `[Vessels] Cleanup: removed ${removed} positions older than ${historyDays}d`
            );
          }
        } catch (err) {
          console.warn("[Vessels] Cleanup failed:", err.message);
        }
      }, 30 * 60 * 1000); // every 30 min
      if (cleanupTimer.unref) cleanupTimer.unref();
    }
  },

  onceSynced: async (_s) => {
    try {
      await VesselPosition.sync();
      console.log("[Vessels] vessel_positions table synced");
    } catch (err) {
      console.warn("[Vessels] Failed to sync vessel_positions:", err.message);
    }
  },
};

module.exports = setup;
