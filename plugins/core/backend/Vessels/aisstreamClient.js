/**
 * AISStream.io WebSocket client.
 *
 * Maintains a single persistent connection to wss://stream.aisstream.io/v0/stream
 * subscribed to one or more bounding boxes (default: Arctic, north of 60N).
 * Caches the latest position report per MMSI in memory with TTL eviction.
 *
 * Why backend-only: AISStream's API key would be exposed if the browser
 * connected directly. A single shared connection also respects rate limits
 * and avoids one upstream connection per visitor.
 */

const WebSocket = require("ws");
const { decodeMmsi } = require("./midTable");

const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";
const RECONNECT_BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];
const STATUS = {
  DISABLED: "disabled",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  ERROR: "error",
};

const TRACK_BUFFER_LEN = 200; // last 200 in-memory positions per MMSI
const TRACK_MIN_MOVE_DEG = 0.0001; // ~11 m at equator; less = noise
const PERSIST_THROTTLE_MS = 60 * 1000; // at most 1 row per MMSI per minute

// ITU-R M.1371-5 navigational status codes
const NAV_STATUS_TEXT = {
  0: "Under way using engine",
  1: "At anchor",
  2: "Not under command",
  3: "Restricted manoeuverability",
  4: "Constrained by draught",
  5: "Moored",
  6: "Aground",
  7: "Engaged in fishing",
  8: "Under way sailing",
  9: "Reserved (HSC)",
  10: "Reserved (WIG)",
  11: "Power-driven vessel towing astern",
  12: "Power-driven vessel pushing ahead",
  13: "Reserved",
  14: "AIS-SART (active)",
  15: "Not defined (default)",
};

function ageHuman(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
}

const AIS_STATIC_TYPES = new Set([
  "ShipStaticData",
  "StaticDataReport",
  "ExtendedClassBPositionReport",
]);

const VESSEL_TYPE_GROUPS = {
  20: "Wing in ground",
  30: "Fishing",
  31: "Towing",
  32: "Towing (large)",
  33: "Dredging",
  34: "Diving",
  35: "Military",
  36: "Sailing",
  37: "Pleasure craft",
  40: "High-speed craft",
  50: "Pilot",
  51: "Search and rescue",
  52: "Tug",
  53: "Port tender",
  54: "Anti-pollution",
  55: "Law enforcement",
  58: "Medical",
  60: "Passenger",
  70: "Cargo",
  80: "Tanker",
  90: "Other",
};

function vesselTypeText(code) {
  if (code == null || isNaN(code)) return "Unknown";
  const base = Math.floor(Number(code) / 10) * 10;
  return VESSEL_TYPE_GROUPS[base] || "Unknown";
}

class AisStreamClient {
  constructor({ apiKey, boundingBoxes, ttlMs, logger, onPositionPersist, VesselPosition }) {
    this.apiKey = apiKey;
    this.boundingBoxes =
      Array.isArray(boundingBoxes) && boundingBoxes.length
        ? boundingBoxes
        : [[[60, -180], [90, 180]]]; // Arctic only
    this.ttlMs = ttlMs > 0 ? ttlMs : 60 * 60 * 1000;
    this.logger = logger || console;
    /** Optional async hook invoked with batches of new positions to persist. */
    this.onPositionPersist =
      typeof onPositionPersist === "function" ? onPositionPersist : null;
    this.VesselPosition = VesselPosition || null;

    this.ws = null;
    this.status = apiKey ? STATUS.CONNECTING : STATUS.DISABLED;
    this.lastError = null;
    this.connectedAt = null;
    this.lastMessageAt = null;
    this.messageCount = 0;
    this.reconnectAttempts = 0;
    this.reconnectTimer = null;
    this.evictTimer = null;
    this.flushTimer = null;

    /** @type {Map<string, object>} keyed by MMSI string — latest snapshot */
    this.vessels = new Map();
    /** @type {Map<string, Array<{lon,lat,t,sog,cog}>>} bounded ring buffer per MMSI */
    this.tracks = new Map();
    /** @type {Map<string, number>} MMSI -> last persist epoch ms */
    this.lastPersistedAt = new Map();
    /** @type {Array<object>} batch waiting to be flushed to PostGIS */
    this.persistQueue = [];
  }

  start() {
    if (!this.apiKey) {
      this.logger.warn(
        "[AisStreamClient] No AISSTREAM_API_KEY set — vessel feed disabled."
      );
      return;
    }
    this._connect();
    this.evictTimer = setInterval(() => this._evictStale(), 60 * 1000);
    if (this.evictTimer.unref) this.evictTimer.unref();
    if (this.onPositionPersist) {
      this.flushTimer = setInterval(() => this._flushPersistQueue(), 5 * 1000);
      if (this.flushTimer.unref) this.flushTimer.unref();
    }
  }

  stop() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.evictTimer) clearInterval(this.evictTimer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.reconnectTimer = null;
    this.evictTimer = null;
    this.flushTimer = null;
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.close();
      } catch (_) {}
      this.ws = null;
    }
    this.status = STATUS.DISABLED;
  }

  status_() {
    return {
      status: this.status,
      connectedAt: this.connectedAt,
      lastMessageAt: this.lastMessageAt,
      messageCount: this.messageCount,
      vesselCount: this.vessels.size,
      trackedCount: this.tracks.size,
      pendingPersist: this.persistQueue.length,
      boundingBoxes: this.boundingBoxes,
      ttlMinutes: Math.round(this.ttlMs / 60000),
      lastError: this.lastError,
    };
  }

  /**
   * Returns vessels filtered by an optional bbox + types + flags.
   * @param {object} [opts]
   * @param {[number,number,number,number]} [opts.bbox] [minLon,minLat,maxLon,maxLat]
   * @param {string[]} [opts.types] case-insensitive substring match against shipTypeText (e.g. ['Cargo','Tanker'])
   * @param {string[]} [opts.flags] ISO2 country codes (e.g. ['NO','RU'])
   * @returns {Array<object>}
   */
  getVessels(opts = {}) {
    const out = [];
    const now = Date.now();
    const bbox = opts.bbox || null;
    const typesLower = Array.isArray(opts.types) && opts.types.length
      ? opts.types.map((t) => String(t).toLowerCase())
      : null;
    const flagsUpper = Array.isArray(opts.flags) && opts.flags.length
      ? opts.flags.map((f) => String(f).toUpperCase())
      : null;

    for (const v of this.vessels.values()) {
      if (now - v._receivedAt > this.ttlMs) continue;
      if (bbox) {
        const [minLon, minLat, maxLon, maxLat] = bbox;
        if (v.lon < minLon || v.lon > maxLon || v.lat < minLat || v.lat > maxLat)
          continue;
      }
      if (typesLower) {
        const t = (v.shipTypeText || "").toLowerCase();
        if (!typesLower.some((q) => t.includes(q))) continue;
      }
      if (flagsUpper) {
        if (!flagsUpper.includes(v.flag)) continue;
      }
      out.push(v);
    }
    return out;
  }

  /**
   * Latest snapshot for one MMSI, or null.
   */
  getVessel(mmsi) {
    const v = this.vessels.get(String(mmsi));
    if (!v) return null;
    if (Date.now() - v._receivedAt > this.ttlMs) return null;
    return v;
  }

  /**
   * Returns the in-memory track buffer for a vessel, ordered oldest-first.
   * @returns {Array<{lon:number,lat:number,t:number,sog?:number,cog?:number}>}
   */
  getTrackBuffer(mmsi) {
    return this.tracks.get(String(mmsi)) || [];
  }

  /**
   * Look up the latest known position for each MMSI at-or-before `at` from PostGIS.
   * Returns an array of GeoJSON-shape vessel records (snake-cased into toGeoJSON shape).
   * Static metadata (name/flag/etc) is enriched from the in-memory cache when
   * the vessel is currently known.
   * @param {Date} at Snapshot timestamp.
   * @param {object} opts {windowMinutes?, bbox?, types?, flags?}
   */
  async getHistoricalSnapshot(at, opts = {}) {
    if (!this.VesselPosition) return [];
    const windowMinutes = Number(opts.windowMinutes) > 0
      ? Number(opts.windowMinutes)
      : 60;
    const cutoff = new Date(at.getTime() - windowMinutes * 60_000);
    const sequelize = this.VesselPosition.sequelize;
    const rows = await sequelize.query(
      `SELECT DISTINCT ON (mmsi) mmsi, lon, lat, speed, course, t_utc
       FROM vessel_positions
       WHERE t_utc <= :at AND t_utc >= :cutoff
       ORDER BY mmsi, t_utc DESC`,
      {
        replacements: { at, cutoff },
        type: sequelize.QueryTypes.SELECT,
      }
    );
    const bbox = opts.bbox || null;
    const typesLower = Array.isArray(opts.types) && opts.types.length
      ? opts.types.map((t) => String(t).toLowerCase())
      : null;
    const flagsUpper = Array.isArray(opts.flags) && opts.flags.length
      ? opts.flags.map((f) => String(f).toUpperCase())
      : null;

    const snapshots = [];
    for (const r of rows) {
      const lon = Number(r.lon);
      const lat = Number(r.lat);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
      if (bbox) {
        const [minLon, minLat, maxLon, maxLat] = bbox;
        if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
      }
      const cached = this.vessels.get(r.mmsi) || {};
      if (typesLower) {
        const t = (cached.shipTypeText || "").toLowerCase();
        if (!typesLower.some((q) => t.includes(q))) continue;
      }
      if (flagsUpper) {
        if (!cached.flag || !flagsUpper.includes(cached.flag)) continue;
      }
      const tUtc = r.t_utc instanceof Date ? r.t_utc : new Date(r.t_utc);
      const ageSeconds = Math.max(
        0,
        Math.round((at.getTime() - tUtc.getTime()) / 1000)
      );
      snapshots.push({
        mmsi: r.mmsi,
        lon,
        lat,
        speed: r.speed != null ? Number(r.speed) : null,
        course: r.course != null ? Number(r.course) : null,
        heading: cached.heading ?? null,
        navStatus: cached.navStatus ?? null,
        name: cached.name || null,
        flag: cached.flag || null,
        flagCountry: cached.flagCountry || null,
        mmsiCategory: cached.mmsiCategory || "vessel",
        callsign: cached.callsign || null,
        imo: cached.imo || null,
        shipType: cached.shipType ?? null,
        shipTypeText: cached.shipTypeText || "Unknown",
        destination: cached.destination || null,
        length: cached.length || null,
        width: cached.width || null,
        draught: cached.draught ?? null,
        timeUtc: tUtc.toISOString(),
        _historical: true,
        _ageSeconds: ageSeconds,
        _receivedAt: tUtc.getTime(),
      });
    }
    return snapshots;
  }

  _connect() {
    this.status = this.reconnectAttempts === 0
      ? STATUS.CONNECTING
      : STATUS.RECONNECTING;
    try {
      // WebSocket options to handle SSL certificate issues in Docker environments
      const wsOptions = {
        rejectUnauthorized: false
      };
      this.ws = new WebSocket(AISSTREAM_URL, wsOptions);
    } catch (err) {
      this._scheduleReconnect(err);
      return;
    }

    this.ws.on("open", () => {
      this.connectedAt = new Date().toISOString();
      this.reconnectAttempts = 0;
      this.status = STATUS.CONNECTED;
      this.lastError = null;
      const subscription = {
        APIKey: this.apiKey,
        BoundingBoxes: this.boundingBoxes,
        FilterMessageTypes: [
          "PositionReport",
          "ShipStaticData",
          "StandardClassBPositionReport",
          "ExtendedClassBPositionReport",
        ],
      };
      try {
        this.ws.send(JSON.stringify(subscription));
        this.logger.info(
          `[AisStreamClient] Subscribed to ${this.boundingBoxes.length} bbox(es)`
        );
      } catch (err) {
        this._scheduleReconnect(err);
      }
    });

    this.ws.on("message", (raw) => {
      this.lastMessageAt = new Date().toISOString();
      this.messageCount++;
      try {
        const msg = JSON.parse(raw.toString());
        this._handleMessage(msg);
      } catch (err) {
        // Ignore malformed messages
      }
    });

    this.ws.on("error", (err) => {
      this.lastError = { message: err.message, at: new Date().toISOString() };
      this.logger.warn(`[AisStreamClient] WS error: ${err.message}`);
    });

    this.ws.on("close", (code, reason) => {
      this.logger.warn(
        `[AisStreamClient] WS closed (code=${code}) ${reason || ""}`
      );
      this._scheduleReconnect();
    });
  }

  _scheduleReconnect(err) {
    if (err) {
      this.lastError = { message: err.message, at: new Date().toISOString() };
    }
    if (this.ws) {
      try { this.ws.removeAllListeners(); this.ws.terminate(); } catch (_) {}
      this.ws = null;
    }
    const delay =
      RECONNECT_BACKOFF_MS[
        Math.min(this.reconnectAttempts, RECONNECT_BACKOFF_MS.length - 1)
      ];
    this.reconnectAttempts++;
    this.status = STATUS.RECONNECTING;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this._connect(), delay);
    if (this.reconnectTimer.unref) this.reconnectTimer.unref();
  }

  _handleMessage(msg) {
    // AISStream format: { MessageType, MetaData: {MMSI, ShipName, latitude, longitude, time_utc}, Message: { ... } }
    const meta = msg && msg.MetaData;
    if (!meta || meta.MMSI == null) return;

    const mmsi = String(meta.MMSI);
    const lat = Number(meta.latitude);
    const lon = Number(meta.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const prev = this.vessels.get(mmsi) || { mmsi };
    const now = Date.now();

    const inner =
      msg.Message &&
      (msg.Message.PositionReport ||
        msg.Message.StandardClassBPositionReport ||
        msg.Message.ExtendedClassBPositionReport ||
        msg.Message.ShipStaticData ||
        Object.values(msg.Message)[0]);

    // Decode flag once per MMSI (cache on the snapshot)
    let flag = prev.flag;
    let flagCountry = prev.flagCountry;
    let mmsiCategory = prev.mmsiCategory;
    if (!flag) {
      const decoded = decodeMmsi(mmsi);
      flag = decoded.iso2;
      flagCountry = decoded.country;
      mmsiCategory = decoded.category;
    }

    const updated = {
      ...prev,
      mmsi,
      lat,
      lon,
      name: (meta.ShipName || prev.name || "Unknown").toString().trim(),
      msgType: msg.MessageType,
      timeUtc: meta.time_utc || prev.timeUtc || null,
      flag,
      flagCountry,
      mmsiCategory,
      _receivedAt: now,
    };

    if (inner) {
      if (inner.Sog != null) updated.speed = Number(inner.Sog);
      if (inner.Cog != null) updated.course = Number(inner.Cog);
      if (inner.TrueHeading != null && inner.TrueHeading !== 511)
        updated.heading = Number(inner.TrueHeading);
      if (inner.NavigationalStatus != null)
        updated.navStatus = Number(inner.NavigationalStatus);
      if (inner.Type != null || inner.ShipType != null) {
        const t = inner.Type != null ? inner.Type : inner.ShipType;
        updated.shipType = Number(t);
        updated.shipTypeText = vesselTypeText(t);
      }
      if (inner.Destination)
        updated.destination = String(inner.Destination).trim();
      if (inner.CallSign) updated.callsign = String(inner.CallSign).trim();
      if (inner.ImoNumber) updated.imo = inner.ImoNumber;
      if (inner.MaximumStaticDraught != null)
        updated.draught = Number(inner.MaximumStaticDraught);
      if (inner.Dimension) {
        const d = inner.Dimension;
        updated.length = (d.A || 0) + (d.B || 0);
        updated.width = (d.C || 0) + (d.D || 0);
      }
    }

    this.vessels.set(mmsi, updated);
    this._maybeAppendTrack(mmsi, prev, updated, now);
  }

  /**
   * Append to in-memory track buffer if vessel actually moved (filters noise),
   * and queue a row for PostGIS persistence if we haven't persisted in PERSIST_THROTTLE_MS.
   */
  _maybeAppendTrack(mmsi, prev, updated, now) {
    // Only PositionReport-class messages have movement data
    if (
      updated.msgType !== "PositionReport" &&
      updated.msgType !== "StandardClassBPositionReport" &&
      updated.msgType !== "ExtendedClassBPositionReport"
    )
      return;

    // Filter MMSI categories that aren't real vessels
    if (
      updated.mmsiCategory === "station" ||
      updated.mmsiCategory === "aton" ||
      updated.mmsiCategory === "invalid"
    )
      return;

    const dLat = prev.lat != null ? Math.abs(updated.lat - prev.lat) : 1;
    const dLon = prev.lon != null ? Math.abs(updated.lon - prev.lon) : 1;
    if (dLat < TRACK_MIN_MOVE_DEG && dLon < TRACK_MIN_MOVE_DEG) return;

    let buf = this.tracks.get(mmsi);
    if (!buf) {
      buf = [];
      this.tracks.set(mmsi, buf);
    }
    buf.push({
      lon: updated.lon,
      lat: updated.lat,
      t: updated.timeUtc ? new Date(updated.timeUtc).getTime() || now : now,
      sog: updated.speed,
      cog: updated.course,
    });
    if (buf.length > TRACK_BUFFER_LEN) buf.splice(0, buf.length - TRACK_BUFFER_LEN);

    // Throttled persistence
    if (this.onPositionPersist) {
      const lastP = this.lastPersistedAt.get(mmsi) || 0;
      if (now - lastP >= PERSIST_THROTTLE_MS) {
        this.persistQueue.push({
          mmsi,
          lon: updated.lon,
          lat: updated.lat,
          speed: updated.speed != null ? updated.speed : null,
          course: updated.course != null ? updated.course : null,
          tUtc: updated.timeUtc ? new Date(updated.timeUtc) : new Date(now),
        });
        this.lastPersistedAt.set(mmsi, now);
      }
    }
  }

  async _flushPersistQueue() {
    if (!this.onPositionPersist || this.persistQueue.length === 0) return;
    const batch = this.persistQueue;
    this.persistQueue = [];
    try {
      await this.onPositionPersist(batch);
    } catch (err) {
      this.logger.warn(
        `[AisStreamClient] Persist flush failed (${batch.length} rows): ${err.message}`
      );
      // Drop the batch to avoid unbounded backlog if DB is sick.
    }
  }

  _evictStale() {
    const cutoff = Date.now() - this.ttlMs;
    let evicted = 0;
    for (const [mmsi, v] of this.vessels) {
      if (v._receivedAt < cutoff) {
        this.vessels.delete(mmsi);
        evicted++;
      }
    }
    if (evicted > 0) {
      this.logger.info(
        `[AisStreamClient] Evicted ${evicted} stale vessel(s); ${this.vessels.size} remain`
      );
    }
  }
}

function toGeoJSON(vessels) {
  return {
    type: "FeatureCollection",
    features: vessels.map((v) => {
      const ageSeconds =
        v._ageSeconds != null
          ? v._ageSeconds
          : Math.round((Date.now() - v._receivedAt) / 1000);
      const navStatusText =
        v.navStatus != null && NAV_STATUS_TEXT[v.navStatus]
          ? NAV_STATUS_TEXT[v.navStatus]
          : null;
      const lat = v.lat != null ? Math.round(v.lat * 1e5) / 1e5 : null;
      const lon = v.lon != null ? Math.round(v.lon * 1e5) / 1e5 : null;
      const mmsi = v.mmsi;
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [v.lon, v.lat],
        },
        properties: {
          mmsi,
          name: v.name,
          displayName: [v.name, v.mmsi, v.flagCountry || v.flag]
            .filter((p) => p && p !== "Unknown" && p !== "??")
            .join(" "),
          flag: v.flag || "??",
          flagCountry: v.flagCountry || "Unknown",
          mmsiCategory: v.mmsiCategory || "vessel",
          callsign: v.callsign || null,
          imo: v.imo || null,
          // Motion
          speedKn: v.speed != null ? `${v.speed} kn` : null,
          courseDeg: v.course != null ? `${v.course}°` : null,
          headingDeg:
            v.heading != null && v.heading !== 511 ? `${v.heading}°` : null,
          speed: v.speed != null ? v.speed : null,
          course: v.course != null ? v.course : null,
          heading: v.heading != null ? v.heading : null,
          navStatus: v.navStatus != null ? v.navStatus : null,
          navStatusText,
          // Identity / class
          shipType: v.shipType != null ? v.shipType : null,
          shipTypeText: v.shipTypeText || "Unknown",
          destination: v.destination || null,
          length: v.length || null,
          width: v.width || null,
          dimensions:
            v.length || v.width
              ? `${v.length || "?"} × ${v.width || "?"} m`
              : null,
          draught: v.draught != null ? `${v.draught} m` : null,
          // Position & freshness
          lat,
          lon,
          position: lat != null && lon != null ? `${lat}, ${lon}` : null,
          timeUtc: v.timeUtc || null,
          ageSeconds,
          lastReport: ageHuman(ageSeconds),
          historical: !!v._historical,
          // External cross-references (Info Tool auto-linkifies URLs)
          marineTrafficUrl: mmsi
            ? `https://www.marinetraffic.com/en/ais/details/ships/mmsi:${mmsi}`
            : null,
          vesselFinderUrl: mmsi
            ? `https://www.vesselfinder.com/vessels/details/${mmsi}`
            : null,
        },
      };
    }),
  };
}

/**
 * Convert an array of {lon,lat,t,...} samples to a GeoJSON LineString feature.
 * Returns null if fewer than 2 points.
 */
function trackToGeoJSON(mmsi, samples, vesselSnapshot) {
  if (!samples || samples.length < 2) return null;
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: sorted.map((s) => [s.lon, s.lat]),
        },
        properties: {
          mmsi: String(mmsi),
          name: vesselSnapshot?.name || null,
          flag: vesselSnapshot?.flag || null,
          flagCountry: vesselSnapshot?.flagCountry || null,
          shipTypeText: vesselSnapshot?.shipTypeText || null,
          pointCount: sorted.length,
          tStart: new Date(sorted[0].t).toISOString(),
          tEnd: new Date(sorted[sorted.length - 1].t).toISOString(),
        },
      },
    ],
  };
}

module.exports = {
  AisStreamClient,
  toGeoJSON,
  trackToGeoJSON,
  vesselTypeText,
  STATUS,
};
