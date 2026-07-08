#!/usr/bin/env node
/**
 * Fix SFNO layer configurations to use correct asset names
 *
 * Issue: Layer configs reference 'asset_b1' but STAC items have 'data' asset
 * Solution: Update cogExpression to use 'data_b1' instead of 'asset_b1'
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'mmgis',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

async function fixSFNOLayers() {
  try {
    await sequelize.authenticate();
    console.log('✓ Connected to database');

    // Get the mission config
    const [results] = await sequelize.query(
      `SELECT mission, config FROM configs WHERE mission = 'frozon_ai_forecast'`
    );

    if (results.length === 0) {
      console.error('✗ Mission frozon_ai_forecast not found');
      process.exit(1);
    }

    const config = results[0].config;
    let modified = false;

    // Find and fix SFNO layers
    config.layers.forEach((layer) => {
      if (layer.sublayers && layer.sublayers.length > 0) {
        layer.sublayers.forEach((sublayer) => {
          if (sublayer.name.includes('SFNO')) {
            console.log(`\nChecking layer: ${sublayer.name}`);

            // Fix cogExpression
            if (sublayer.cogExpression && sublayer.cogExpression.includes('asset_b1')) {
              console.log(`  - Old expression: ${sublayer.cogExpression}`);
              sublayer.cogExpression = sublayer.cogExpression.replace(/asset_b1/g, 'data_b1');
              console.log(`  - New expression: ${sublayer.cogExpression}`);
              modified = true;
            }

            // Fix cogBands - change to asset name
            if (sublayer.cogBands && JSON.stringify(sublayer.cogBands) === '["1"]') {
              console.log(`  - Old cogBands: ${JSON.stringify(sublayer.cogBands)}`);
              sublayer.cogBands = ['data'];
              console.log(`  - New cogBands: ${JSON.stringify(sublayer.cogBands)}`);
              modified = true;
            }

            // Fix cogBandsQuery
            if (sublayer.cogBandsQuery && JSON.stringify(sublayer.cogBandsQuery) === '["1"]') {
              console.log(`  - Old cogBandsQuery: ${JSON.stringify(sublayer.cogBandsQuery)}`);
              sublayer.cogBandsQuery = ['data'];
              console.log(`  - New cogBandsQuery: ${JSON.stringify(sublayer.cogBandsQuery)}`);
              modified = true;
            }
          }
        });
      }
    });

    if (!modified) {
      console.log('\n✓ No changes needed - layers already configured correctly');
      process.exit(0);
    }

    // Update the config
    await sequelize.query(
      `UPDATE configs SET config = :config WHERE mission = 'frozon_ai_forecast'`,
      {
        replacements: { config: JSON.stringify(config) },
        type: Sequelize.QueryTypes.UPDATE
      }
    );

    console.log('\n✓ Successfully updated SFNO layer configurations');
    console.log('\nPlease refresh your browser to see the changes.');

  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

fixSFNOLayers();
