#!/usr/bin/env node
/**
 * Force update mission config from file to database
 */

const fs = require('fs');
const path = require('path');
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

async function updateMissionFromFile() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected\n');

    // Read the file
    const filePath = path.join(__dirname, 'Missions', 'frozon_ai_forecast_v38_config.json');
    console.log('📁 Reading file:', filePath);

    const configData = fs.readFileSync(filePath, 'utf8');
    const config = JSON.parse(configData);

    console.log(`   Layers in file: ${config.layers.length}`);
    config.layers.forEach((l, i) => {
      console.log(`   ${i + 1}. ${l.name} (${l.type})`);
    });

    // Update database
    console.log('\n💾 Updating database...');
    const result = await sequelize.query(
      `UPDATE configs
       SET config = :config::json,
           version = version + 1
       WHERE mission = 'frozon_ai_forecast'
       RETURNING id, mission, version`,
      {
        replacements: { config: JSON.stringify(config) },
        type: Sequelize.QueryTypes.UPDATE
      }
    );

    if (result && result[0] && result[0].length > 0) {
      const updated = result[0][0];
      console.log(`✅ Updated mission: ${updated.mission}`);
      console.log(`   Version: ${updated.version}`);
      console.log(`   ID: ${updated.id}`);
    } else {
      console.log('⚠️  No rows updated');
    }

    // Verify
    console.log('\n🔍 Verifying...');
    const verify = await sequelize.query(
      `SELECT json_array_length(config::json->'layers') as layer_count
       FROM configs
       WHERE mission = 'frozon_ai_forecast'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (verify && verify[0]) {
      console.log(`✅ Database now has ${verify[0].layer_count} layers`);
    }

    console.log('\n✅ Update complete!');
    console.log('\n🌐 Test the mission: http://localhost:8888/?mission=frozon_ai_forecast');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

updateMissionFromFile();
