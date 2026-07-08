#!/bin/bash
# Fix layer toggle infinite loading by disabling time-based querying

set -e

echo "======================================"
echo "Fixing Layer Toggle Issue"
echo "======================================"

CONFIG_FILE="Missions/frozon_ai_forecast_v38_config.json"

echo "1. Backing up mission config..."
cp "$CONFIG_FILE" "${CONFIG_FILE}.backup-$(date +%s)"

echo "2. Disabling time for Aircraft and Vessels layers..."

# Use Python to safely modify JSON
python3 << 'PYTHON_SCRIPT'
import json
import sys

config_file = "Missions/frozon_ai_forecast_v38_config.json"

# Read config
with open(config_file, 'r') as f:
    config = json.load(f)

# Find and fix Aircraft and Vessels layers
fixed_count = 0
for layer in config.get('layers', []):
    if 'Aircraft' in layer.get('name', '') or 'Vessels' in layer.get('name', ''):
        if 'time' in layer and layer['time'].get('enabled'):
            print(f"  Disabling time for: {layer['name']}")
            layer['time']['enabled'] = False
            fixed_count += 1

# Write back
with open(config_file, 'w') as f:
    json.dump(config, f, indent=2)

print(f"\n✅ Fixed {fixed_count} layers")
PYTHON_SCRIPT

echo ""
echo "3. Copying fixed config to Docker container..."
docker cp "$CONFIG_FILE" mmgis-mmgis-1:/usr/src/app/Missions/frozon_ai_forecast_v38_config.json

echo ""
echo "✅ Layer toggle fix applied!"
echo ""
echo "Test at: http://localhost:8888/?mission=frozon_ai_forecast"
echo "Layers should now toggle instantly without infinite loading"
echo ""
