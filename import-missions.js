#!/usr/bin/env node
/**
 * Import mission config files into the database
 * Usage: node import-missions.js
 */

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

// Load environment variables
require('dotenv').config();

// Database connection
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

// Define Configs model (matching actual schema)
const Configs = sequelize.define('configs', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  mission: {
    type: Sequelize.STRING,
    allowNull: false,
  },
  config: {
    type: Sequelize.JSON,
    allowNull: false,
    defaultValue: {},
  },
  version: {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  createdAt: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW,
  },
}, {
  timestamps: false,
  tableName: 'configs',
});

async function importMissions() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    const missionsDir = path.join(__dirname, 'Missions');

    // Find all *_config.json files
    const files = fs.readdirSync(missionsDir)
      .filter(f => f.endsWith('_config.json') && !f.includes('.backup'));

    console.log(`\n📁 Found ${files.length} mission config files:\n`);

    for (const file of files) {
      try {
        const filePath = path.join(missionsDir, file);
        const configData = fs.readFileSync(filePath, 'utf8');
        const config = JSON.parse(configData);

        // Extract mission name from filename (e.g., "frozon_v116_config.json" -> "frozon")
        // Or use the mission name from the config if available
        let missionName = config.msv?.mission || config.mission;

        if (!missionName) {
          // Fallback: extract from filename
          missionName = file.replace(/_config\.json$/, '').replace(/_v\d+$/, '');
        }

        console.log(`  Processing: ${file}`);
        console.log(`    Mission: ${missionName}`);

        // Check if mission already exists
        const existing = await Configs.findOne({ where: { mission: missionName } });

        if (existing) {
          console.log(`    ⚠️  Already exists - skipping`);
        } else {
          // Insert into database
          await Configs.create({
            mission: missionName,
            config: config,  // Use parsed JSON object, not string
            version: 0,
            createdAt: new Date(),
          });
          console.log(`    ✅ Imported successfully`);
        }
      } catch (err) {
        console.error(`    ❌ Error processing ${file}:`, err.message);
      }
    }

    // Show final status
    console.log('\n📊 Current missions in database:');
    const allMissions = await Configs.findAll({
      attributes: ['mission', 'id'],
      order: [['mission', 'ASC']],
    });

    if (allMissions.length === 0) {
      console.log('  (none)');
    } else {
      allMissions.forEach(m => {
        console.log(`  - ${m.mission} (id: ${m.id})`);
      });
    }

    console.log('\n✅ Import complete!');
    console.log('\n📍 Access your missions at: http://localhost:8888');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run import
importMissions();
