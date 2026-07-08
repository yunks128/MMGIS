/**
 * OpenSky Network REST API client for real-time aircraft ADS-B positions.
 *
 * Polls OpenSky Network API at a configurable interval, caches positions in-memory,
 * and optionally persists to PostgreSQL for historical track replay.
 *
 * Similar architecture to aisstreamClient but using REST polling instead of WebSocket.
 */

const OPENSKY_TOKEN_URL =
  "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
// Anonymous accounts get ~400 credits/day and a global-sized bbox costs 4
// credits per request, so anything faster than ~15 minutes exhausts the
// quota and OpenSky answers 429 for the rest of the day.
const MIN_ANONYMOUS_POLL_MS = 15 * 60 * 1000;

class OpenSkyClient {
  constructor(opts = {}) {
    this.bbox = opts.bbox || { lamin: 66.5, lomin: -180, lamax: 90, lomax: 180 };
    this.pollIntervalMs = opts.pollIntervalMs || 30000;
    this.ttlMs = opts.ttlMs || 60 * 60 * 1000; // Default 1 hour TTL
    this.logger = opts.logger || console;
    this.onPositionPersist = opts.onPositionPersist || null;
    this.AircraftPosition = opts.AircraftPosition || null;

    // OAuth2 client-credentials (register at opensky-network.org for higher quota)
    this.clientId = opts.clientId || null;
    this.clientSecret = opts.clientSecret || null;
    this._token = null;
    this._tokenExpiresAt = 0;

    // Rate-limit state: when OpenSky answers 429, suspend polling until
    // the time it tells us to retry at instead of burning more requests
    this.suspendedUntil = 0;

    if (
      (!this.clientId || !this.clientSecret) &&
      this.pollIntervalMs < MIN_ANONYMOUS_POLL_MS
    ) {
      this.logger.warn(
        `[OpenSky] No OPENSKY_CLIENT_ID/OPENSKY_CLIENT_SECRET configured; ` +
          `clamping poll interval from ${this.pollIntervalMs}ms to ${MIN_ANONYMOUS_POLL_MS}ms ` +
          `to stay within the anonymous daily quota`
      );
      this.pollIntervalMs = MIN_ANONYMOUS_POLL_MS;
    }

    // In-memory cache: { icao24 -> { icao24, callsign, lat, lon, altitude, ... } }
    this.cache = new Map();

    // Persist queue: batch writes to DB
    this.persistQueue = [];
    this.persistBatchSize = 100;
    this.persistFlushIntervalMs = 60000; // Flush every 60s

    // Track last persist time per aircraft to throttle writes (1 per minute per ICAO24)
    this.lastPersistTime = new Map();

    this.pollTimer = null;
    this.persistTimer = null;
    this.isRunning = false;
  }

  /**
   * Start polling OpenSky API
   */
  start() {
    if (this.isRunning) {
      this.logger.warn("[OpenSky] Client already running");
      return;
    }
    this.isRunning = true;
    this.logger.log("[OpenSky] Starting client with bbox:", this.bbox);

    // Initial poll
    this._poll().catch((err) => {
      this.logger.error("[OpenSky] Initial poll failed:", err.message);
    });

    // Schedule recurring polls
    this.pollTimer = setInterval(() => {
      this._poll().catch((err) => {
        this.logger.error("[OpenSky] Poll failed:", err.message);
      });
    }, this.pollIntervalMs);

    // Schedule persist queue flushes
    if (this.onPositionPersist) {
      this.persistTimer = setInterval(() => {
        this._flushPersistQueue().catch((err) => {
          this.logger.error("[OpenSky] Persist flush failed:", err.message);
        });
      }, this.persistFlushIntervalMs);
    }

    this.logger.log("[OpenSky] Client started");
  }

  /**
   * Stop polling and clean up
   */
  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.persistTimer) clearInterval(this.persistTimer);
    this.isRunning = false;
    this.logger.log("[OpenSky] Client stopped");
  }

  /**
   * Get (and cache) an OAuth2 access token via client credentials.
   * Returns null when no credentials are configured or the request fails.
   */
  async _getToken() {
    if (!this.clientId || !this.clientSecret) return null;
    const now = Date.now();
    if (this._token && now < this._tokenExpiresAt - 60000) return this._token;

    try {
      const response = await fetch(OPENSKY_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });
      if (!response.ok) {
        this.logger.warn(
          `[OpenSky] Token request failed (HTTP ${response.status}); falling back to anonymous access`
        );
        return null;
      }
      const data = await response.json();
      this._token = data.access_token || null;
      this._tokenExpiresAt = now + (data.expires_in || 1800) * 1000;
      return this._token;
    } catch (err) {
      this.logger.warn("[OpenSky] Token request error:", err.message);
      return null;
    }
  }

  /**
   * Poll OpenSky API for current aircraft positions
   */
  async _poll() {
    if (Date.now() < this.suspendedUntil) return;

    const { lamin, lomin, lamax, lomax } = this.bbox;
    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

    try {
      const headers = {};
      const token = await this._getToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(url, { headers });
      if (response.status === 429) {
        const retryAfterSec =
          Number(response.headers.get("x-rate-limit-retry-after-seconds")) ||
          600;
        this.suspendedUntil = Date.now() + retryAfterSec * 1000;
        this.logger.warn(
          `[OpenSky] Rate limited (429). Suspending polls for ${Math.round(
            retryAfterSec / 60
          )} min (until ${new Date(this.suspendedUntil).toISOString()}). ` +
            `Configure OPENSKY_CLIENT_ID/OPENSKY_CLIENT_SECRET for a higher quota.`
        );
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.states || !Array.isArray(data.states)) {
        this.logger.warn("[OpenSky] No states array in response");
        return;
      }

      this._processStates(data.states);
      this.logger.log(`[OpenSky] Polled ${data.states.length} aircraft`);
    } catch (err) {
      this.logger.error("[OpenSky] Poll error:", err.message);
    }
  }

  /**
   * Process OpenSky state vectors and update cache
   * @param {Array} states - Array of state vectors from OpenSky API
   */
  _processStates(states) {
    const now = Date.now();
    const cutoff = now - this.ttlMs;

    for (const state of states) {
      // OpenSky state vector format:
      // [icao24, callsign, origin_country, time_position, last_contact,
      //  longitude, latitude, baro_altitude, on_ground, velocity,
      //  true_track, vertical_rate, sensors, geo_altitude, squawk, spi, position_source]

      const aircraft = {
        icao24: state[0],
        callsign: state[1] ? String(state[1]).trim() : null,
        origin_country: state[2],
        lon: state[5],
        lat: state[6],
        altitude: state[7], // barometric altitude in meters
        on_ground: state[8],
        velocity: state[9], // m/s
        heading: state[10], // true track in degrees
        vertical_rate: state[11], // m/s
        last_contact: state[4] ? new Date(state[4] * 1000) : new Date(),
        _timestamp: now,
      };

      // Skip if missing critical fields
      if (!aircraft.icao24 || aircraft.lon == null || aircraft.lat == null) {
        continue;
      }

      // Update cache
      this.cache.set(aircraft.icao24, aircraft);

      // Enqueue for persistence (throttled: 1 write per minute per ICAO24)
      if (this.onPositionPersist) {
        const lastPersist = this.lastPersistTime.get(aircraft.icao24) || 0;
        if (now - lastPersist >= 60000) {
          // 1 minute throttle
          this.persistQueue.push(aircraft);
          this.lastPersistTime.set(aircraft.icao24, now);

          // Flush if batch size reached
          if (this.persistQueue.length >= this.persistBatchSize) {
            this._flushPersistQueue().catch((err) => {
              this.logger.error("[OpenSky] Batch flush failed:", err.message);
            });
          }
        }
      }
    }

    // Prune stale entries from cache
    for (const [icao24, aircraft] of this.cache.entries()) {
      if (aircraft._timestamp < cutoff) {
        this.cache.delete(icao24);
      }
    }
  }

  /**
   * Flush persist queue to database
   */
  async _flushPersistQueue() {
    if (this.persistQueue.length === 0) return;

    const batch = this.persistQueue.splice(0, this.persistBatchSize);
    try {
      await this.onPositionPersist(batch);
      this.logger.log(
        `[OpenSky] Persisted ${batch.length} positions to database`
      );
    } catch (err) {
      this.logger.error("[OpenSky] Persist failed:", err.message);
      // Don't re-queue on failure to avoid memory leak
    }
  }

  /**
   * Get all aircraft matching filters
   * @param {Object} opts - { bbox?: [minLon,minLat,maxLon,maxLat], countries?: string[] }
   * @returns {Array} Array of aircraft objects
   */
  getAircraft(opts = {}) {
    let results = Array.from(this.cache.values());

    // Filter by bbox
    if (opts.bbox && Array.isArray(opts.bbox) && opts.bbox.length === 4) {
      const [minLon, minLat, maxLon, maxLat] = opts.bbox;
      results = results.filter(
        (a) =>
          a.lon >= minLon && a.lon <= maxLon && a.lat >= minLat && a.lat <= maxLat
      );
    }

    // Filter by country
    if (opts.countries && Array.isArray(opts.countries)) {
      const countries = opts.countries.map((c) => c.toLowerCase());
      results = results.filter(
        (a) =>
          a.origin_country &&
          countries.includes(a.origin_country.toLowerCase())
      );
    }

    return results;
  }

  /**
   * Get single aircraft by ICAO24
   * @param {string} icao24
   * @returns {Object|null}
   */
  getAircraftByIcao24(icao24) {
    return this.cache.get(icao24) || null;
  }

  /**
   * Get historical snapshot from database
   * @param {Date} at - Timestamp to query
   * @param {Object} opts - { windowMinutes?: number, bbox?: Array, countries?: Array }
   * @returns {Promise<Array>} Array of aircraft objects
   */
  async getHistoricalSnapshot(at, opts = {}) {
    if (!this.AircraftPosition) {
      throw new Error("AircraftPosition model not configured");
    }

    const { Op } = require("sequelize");
    const windowMinutes = opts.windowMinutes || 60;
    const windowStart = new Date(at.getTime() - windowMinutes * 60 * 1000);

    const where = {
      last_contact: {
        [Op.gte]: windowStart,
        [Op.lte]: at,
      },
    };

    // Add bbox filter
    if (opts.bbox && Array.isArray(opts.bbox) && opts.bbox.length === 4) {
      const [minLon, minLat, maxLon, maxLat] = opts.bbox;
      where.lon = { [Op.gte]: minLon, [Op.lte]: maxLon };
      where.lat = { [Op.gte]: minLat, [Op.lte]: maxLat };
    }

    // Add country filter
    if (opts.countries && Array.isArray(opts.countries)) {
      where.origin_country = { [Op.in]: opts.countries };
    }

    try {
      // Get the latest position for each aircraft within the time window
      const rows = await this.AircraftPosition.sequelize.query(
        `
        SELECT DISTINCT ON (icao24)
          icao24, callsign, origin_country, lon, lat, altitude,
          velocity, heading, vertical_rate, on_ground, last_contact
        FROM aircraft_positions
        WHERE last_contact >= :windowStart AND last_contact <= :at
        ${opts.bbox ? "AND lon >= :minLon AND lon <= :maxLon AND lat >= :minLat AND lat <= :maxLat" : ""}
        ${opts.countries ? "AND origin_country = ANY(:countries)" : ""}
        ORDER BY icao24, last_contact DESC
        LIMIT 5000
        `,
        {
          replacements: {
            windowStart,
            at,
            minLon: opts.bbox?.[0],
            maxLon: opts.bbox?.[2],
            minLat: opts.bbox?.[1],
            maxLat: opts.bbox?.[3],
            countries: opts.countries,
          },
          type: this.AircraftPosition.sequelize.QueryTypes.SELECT,
        }
      );

      return rows.map((r) => ({
        icao24: r.icao24,
        callsign: r.callsign,
        origin_country: r.origin_country,
        lon: r.lon,
        lat: r.lat,
        altitude: r.altitude,
        velocity: r.velocity,
        heading: r.heading,
        vertical_rate: r.vertical_rate,
        on_ground: r.on_ground,
        last_contact: r.last_contact,
      }));
    } catch (err) {
      this.logger.error("[OpenSky] Historical snapshot query failed:", err.message);
      throw err;
    }
  }

  /**
   * Get track buffer for a specific aircraft (in-memory only)
   * @param {string} icao24
   * @returns {Array} Array of position samples
   */
  getTrackBuffer(icao24) {
    // For now, return single current position (no in-memory ring buffer like vessels)
    const aircraft = this.cache.get(icao24);
    if (!aircraft) return [];

    return [
      {
        lon: aircraft.lon,
        lat: aircraft.lat,
        t: aircraft.last_contact.getTime(),
        altitude: aircraft.altitude,
        velocity: aircraft.velocity,
        heading: aircraft.heading,
      },
    ];
  }

  /**
   * Get status diagnostics
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      cacheSize: this.cache.size,
      persistQueueSize: this.persistQueue.length,
      bbox: this.bbox,
      pollIntervalMs: this.pollIntervalMs,
      ttlMs: this.ttlMs,
      authenticated: !!(this.clientId && this.clientSecret),
      rateLimitedUntil:
        Date.now() < this.suspendedUntil
          ? new Date(this.suspendedUntil).toISOString()
          : null,
    };
  }
}

/**
 * Convert aircraft array to GeoJSON FeatureCollection
 */
function toGeoJSON(aircraft) {
  const features = aircraft.map((a) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [a.lon, a.lat],
    },
    properties: {
      icao24: a.icao24,
      callsign: a.callsign,
      origin_country: a.origin_country,
      altitude: a.altitude,
      velocity: a.velocity,
      heading: a.heading,
      vertical_rate: a.vertical_rate,
      on_ground: a.on_ground,
      last_contact: a.last_contact.toISOString(),
      displayName: a.callsign || a.icao24,
    },
  }));

  return {
    type: "FeatureCollection",
    features,
  };
}

/**
 * Convert track samples to GeoJSON LineString
 */
function trackToGeoJSON(samples) {
  const coordinates = samples.map((s) => [s.lon, s.lat]);
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates,
        },
        properties: {
          sampleCount: samples.length,
        },
      },
    ],
  };
}

module.exports = { OpenSkyClient, toGeoJSON, trackToGeoJSON };
