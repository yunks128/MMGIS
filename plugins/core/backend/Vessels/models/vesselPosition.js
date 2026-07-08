const Sequelize = require("sequelize");
const { sequelize } = require("../../../../../API/connection");

/**
 * VesselPosition: durable history of AIS PositionReports keyed by MMSI.
 * Used to render historical tracks ("show route for vessel X").
 *
 * Writes are throttled by aisstreamClient (1 row per MMSI per minute) so a
 * busy port doesn't generate hundreds of thousands of rows per hour.
 *
 * A periodic sweeper deletes rows older than VESSEL_HISTORY_DAYS (default 7).
 */
const VesselPosition = sequelize.define(
  "vessel_positions",
  {
    id: {
      type: Sequelize.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },
    mmsi: {
      type: Sequelize.STRING(15),
      allowNull: false,
    },
    lon: {
      type: Sequelize.DOUBLE,
      allowNull: false,
    },
    lat: {
      type: Sequelize.DOUBLE,
      allowNull: false,
    },
    speed: {
      type: Sequelize.FLOAT,
      allowNull: true,
    },
    course: {
      type: Sequelize.FLOAT,
      allowNull: true,
    },
    tUtc: {
      type: Sequelize.DATE,
      allowNull: false,
      field: "t_utc",
    },
  },
  {
    timestamps: true,
    indexes: [
      { fields: ["mmsi", { name: "t_utc", order: "DESC" }] },
    ],
  },
);

module.exports = VesselPosition;
