#!/usr/bin/env node
/**
 * Optimize aircraft layer for faster loading
 * - Disable time filtering on initial load
 * - Simplify time configuration
 */

const Sequelize = require('sequelize');
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

async function optimizeLayer() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected\n');

    // Get current config
    const result = await sequelize.query(
      `SELECT config FROM configs WHERE mission = 'frozon_ai_forecast'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!result || result.length === 0) {
      console.error('❌ Mission not found');
      process.exit(1);
    }

    const config = result[0].config;
    const aircraftLayer = config.layers.find(l => l.name === 'Aircraft (Live ADS-B)');

    if (!aircraftLayer) {
      console.error('❌ Aircraft layer not found');
      process.exit(1);
    }

    console.log('📋 Current aircraft layer config:');
    console.log('   Time enabled:', aircraftLayer.time.enabled);
    console.log('   Refresh interval:', aircraftLayer.time.refreshIntervalAmount);
    console.log('   Time type:', aircraftLayer.time.type);

    // Optimize time configuration
    console.log('\n🔧 Optimizing...');

    // Simplify time config - disable time filtering for live data
    aircraftLayer.time = {
      enabled: false,  // Disable time filtering for faster loading
      type: "requery",
      refreshIntervalEnabled: true,
      refreshIntervalAmount: 30  // Update every 30 seconds
    };

    // Also optimize vessel layer if present
    const vesselLayer = config.layers.find(l => l.name === 'Vessels (Live AIS)');
    if (vesselLayer) {
      vesselLayer.time = {
        enabled: false,  // Disable time filtering for faster loading
        type: "requery",
        refreshIntervalEnabled: true,
        refreshIntervalAmount: 60  // Update every 60 seconds
      };
      console.log('   ✅ Optimized vessel layer too');
    }

    // Update database
    await sequelize.query(
      `UPDATE configs
       SET config = :config::json,
           version = version + 1
       WHERE mission = 'frozon_ai_forecast'`,
      {
        replacements: { config: JSON.stringify(config) },
        type: Sequelize.QueryTypes.UPDATE
      }
    );

    console.log('   ✅ Updated aircraft layer');
    console.log('\n📝 Changes made:');
    console.log('   - Disabled time filtering (faster initial load)');
    console.log('   - Kept auto-refresh at 30 seconds');
    console.log('   - Simplified time configuration');

    console.log('\n✅ Optimization complete!');
    console.log('\n💡 The layer should now load instantly.');
    console.log('   Refresh your browser and try again.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

optimizeLayer();
