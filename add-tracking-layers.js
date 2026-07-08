#!/usr/bin/env node
/**
 * Add vessel and aircraft tracking layers to frozon_ai_forecast mission
 */

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'mmgis',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

const Configs = sequelize.define('configs', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  mission: { type: Sequelize.STRING, allowNull: false },
  config: { type: Sequelize.JSON, allowNull: false, defaultValue: {} },
  version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
  createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
}, {
  timestamps: false,
  tableName: 'configs',
});

// Vessel tracking layer definition
const vesselLayer = {
  "name": "Vessels (Live AIS)",
  "uuid": uuidv4(),
  "sublayers": [],
  "type": "vector",
  "visibility": false,
  "url": "/api/vessels/live",
  "controlled": false,
  "initialOpacity": 1,
  "time": {
    "enabled": true,
    "type": "requery",
    "isRelative": false,
    "current": "",
    "start": "",
    "end": "",
    "startProp": "timestamp",
    "endProp": "timestamp",
    "timefield": "timestamp",
    "format": "ISO 8601",
    "compositeTile": false,
    "refreshIntervalEnabled": true,
    "refreshIntervalAmount": 60
  },
  "style": {
    "useKeyAsName": "name",
    "radius": 6,
    "fillColor": "#10b981",
    "color": "#ffffff",
    "weight": 1,
    "fillOpacity": 0.85,
    "opacity": 1
  },
  "variables": {
    "search": "(mmsi name destination)"
  },
  "description": "### Live Vessel Tracking\n\nReal-time ship positions from AIS (Automatic Identification System) data.\n\n**Features:**\n- Live vessel positions updated every 60 seconds\n- Click any vessel to view detailed information and 24-hour track\n- Vessel types color-coded by category\n- Arctic shipping corridor coverage\n\n**Data Source:** [AISStream.io](https://aisstream.io/)\n\n**Note:** Requires AISSTREAM_API_KEY to be configured in .env file."
};

// Aircraft tracking layer definition
const aircraftLayer = {
  "name": "Aircraft (Live ADS-B)",
  "uuid": uuidv4(),
  "sublayers": [],
  "type": "vector",
  "visibility": false,
  "url": "/api/aircraft/live",
  "controlled": false,
  "initialOpacity": 1,
  "time": {
    "enabled": true,
    "type": "requery",
    "isRelative": false,
    "current": "",
    "start": "",
    "end": "",
    "startProp": "last_contact",
    "endProp": "last_contact",
    "timefield": "last_contact",
    "format": "ISO 8601",
    "compositeTile": false,
    "refreshIntervalEnabled": true,
    "refreshIntervalAmount": 30
  },
  "style": {
    "useKeyAsName": "callsign",
    "radius": 6,
    "fillColor": "#2563eb",
    "color": "#ffffff",
    "weight": 1,
    "fillOpacity": 0.85,
    "opacity": 1
  },
  "variables": {
    "search": "(callsign icao24)"
  },
  "description": "### Live Aircraft Tracking\n\nReal-time aircraft positions from OpenSky Network ADS-B data.\n\n**Features:**\n- Live aircraft positions updated every 30 seconds\n- Click any aircraft to view detailed information and 24-hour track\n- Grounded aircraft shown in gray, airborne in blue\n- Full Arctic Circle coverage (66.5°N and above)\n\n**Data Source:** [OpenSky Network](https://opensky-network.org/)\n\n**Note:** ADS-B coverage is sparse over remote Arctic regions due to limited ground stations."
};

async function addTrackingLayers() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected\n');

    // Get frozon_ai_forecast mission
    const mission = await Configs.findOne({
      where: { mission: 'frozon_ai_forecast' }
    });

    if (!mission) {
      console.error('❌ Mission "frozon_ai_forecast" not found');
      process.exit(1);
    }

    console.log('📋 Current mission: frozon_ai_forecast');
    const config = mission.config;

    if (!config.layers) {
      console.error('❌ No layers array found in config');
      process.exit(1);
    }

    console.log(`   Current layers: ${config.layers.length}`);
    config.layers.forEach((l, i) => {
      console.log(`   ${i + 1}. ${l.name} (${l.type})`);
    });

    // Check if layers already exist
    const hasVessel = config.layers.some(l =>
      l.name && (l.name.toLowerCase().includes('vessel') || l.name.toLowerCase().includes('ais'))
    );
    const hasAircraft = config.layers.some(l =>
      l.name && (l.name.toLowerCase().includes('aircraft') || l.name.toLowerCase().includes('ads-b'))
    );

    console.log('\n🔍 Checking for existing tracking layers:');
    console.log(`   Vessel layer: ${hasVessel ? '✓ Already exists' : '✗ Missing'}`);
    console.log(`   Aircraft layer: ${hasAircraft ? '✓ Already exists' : '✗ Missing'}`);

    let updated = false;

    // Add vessel layer if missing
    if (!hasVessel) {
      console.log('\n➕ Adding Vessel tracking layer...');
      config.layers.push(vesselLayer);
      updated = true;
    }

    // Add aircraft layer if missing
    if (!hasAircraft) {
      console.log('➕ Adding Aircraft tracking layer...');
      config.layers.push(aircraftLayer);
      updated = true;
    }

    if (updated) {
      // Update database
      await mission.update({
        config: config,
        version: mission.version + 1
      });

      // Update file
      const filePath = path.join(__dirname, 'Missions', 'frozon_ai_forecast_v38_config.json');
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2));

      console.log('\n✅ Layers added successfully!');
      console.log(`   Total layers now: ${config.layers.length}`);
      console.log('\n📝 Updated:');
      console.log('   - Database (configs table)');
      console.log('   - File (Missions/frozon_ai_forecast_v38_config.json)');
    } else {
      console.log('\n✓ All tracking layers already present - no changes needed');
    }

    console.log('\n🔧 Configuration Notes:');
    console.log('   Vessel Tracking: Requires AISSTREAM_API_KEY in .env');
    console.log('   Aircraft Tracking: Works without API key (OpenSky public API)');
    console.log('\n🌐 Access mission: http://localhost:8888/?mission=frozon_ai_forecast');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

addTrackingLayers();
