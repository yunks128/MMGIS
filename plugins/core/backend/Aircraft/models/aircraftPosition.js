const Sequelize = require("sequelize");
const { sequelize } = require("../../../connection");

/**
 * AircraftPosition: durable history of ADS-B position reports keyed by ICAO24.
 * Used to render historical tracks ("show route for aircraft X").
 *
 * Writes are throttled by openskyClient (1 row per ICAO24 per minute) to prevent
 * database bloat.
 *
 * A periodic sweeper deletes rows older than AIRCRAFT_HISTORY_DAYS (default 7).
 */
const AircraftPosition = sequelize.define(
  "aircraft_positions",
  {
    id: {
      type: Sequelize.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    icao24: {
      type: Sequelize.STRING(10),
      allowNull: false,
      comment: "ICAO 24-bit address (unique aircraft identifier)",
    },
    callsign: {
      type: Sequelize.STRING(16),
      allowNull: true,
      comment: "Flight callsign",
    },
    origin_country: {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: "Country of registration",
    },
    lon: {
      type: Sequelize.DOUBLE,
      allowNull: false,
      comment: "Longitude in decimal degrees",
    },
    lat: {
      type: Sequelize.DOUBLE,
      allowNull: false,
      comment: "Latitude in decimal degrees",
    },
    altitude: {
      type: Sequelize.FLOAT,
      allowNull: true,
      comment: "Barometric altitude in meters",
    },
    velocity: {
      type: Sequelize.FLOAT,
      allowNull: true,
      comment: "Ground speed in m/s",
    },
    heading: {
      type: Sequelize.FLOAT,
      allowNull: true,
      comment: "True track in degrees [0, 360)",
    },
    vertical_rate: {
      type: Sequelize.FLOAT,
      allowNull: true,
      comment: "Vertical rate in m/s (+ = climbing, - = descending)",
    },
    on_ground: {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      comment: "Is aircraft on ground?",
    },
    last_contact: {
      type: Sequelize.DATE,
      allowNull: false,
      comment: "Timestamp of last ADS-B message",
    },
  },
  {
    timestamps: true,
    indexes: [
      { fields: ["icao24", { name: "last_contact", order: "DESC" }] },
      { fields: ["last_contact"] },
    ],
  }
);

module.exports = AircraftPosition;
