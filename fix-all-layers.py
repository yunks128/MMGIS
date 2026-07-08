#!/usr/bin/env python3
"""
Fix all layer issues in frozon_ai_forecast mission config:
1. Disable time for Aircraft/Vessels
2. Simplify styling to avoid undefined property errors
3. Fix any other layer configuration issues
"""

import json
import sys
from pathlib import Path

config_file = Path("Missions/frozon_ai_forecast_v38_config.json")

print("Loading mission config...")
with open(config_file, 'r') as f:
    config = json.load(f)

fixed_count = 0

for layer in config.get('layers', []):
    layer_name = layer.get('name', '')

    # Fix Aircraft layer
    if 'Aircraft' in layer_name:
        print(f"Fixing: {layer_name}")

        # Disable time-based querying
        if 'time' in layer and layer['time'].get('enabled'):
            layer['time']['enabled'] = False
            print(f"  - Disabled time querying")

        # Simplify style to basic static styling
        layer['style'] = {
            "radius": 6,
            "fillColor": "#2563eb",
            "color": "#ffffff",
            "weight": 1,
            "fillOpacity": 0.85,
            "opacity": 1
        }
        print(f"  - Simplified styling")
        fixed_count += 1

    # Fix Vessels layer
    elif 'Vessels' in layer_name or 'Vessel' in layer_name:
        print(f"Fixing: {layer_name}")

        # Disable time-based querying
        if 'time' in layer and layer['time'].get('enabled'):
            layer['time']['enabled'] = False
            print(f"  - Disabled time querying")

        # Simplify style to basic static styling
        layer['style'] = {
            "radius": 6,
            "fillColor": "#10b981",
            "color": "#ffffff",
            "weight": 1,
            "fillOpacity": 0.85,
            "opacity": 1
        }
        print(f"  - Simplified styling")
        fixed_count += 1

print(f"\nFixed {fixed_count} layers")

# Write back
print("Writing updated config...")
with open(config_file, 'w') as f:
    json.dump(config, f, indent=2)

print("✅ Done! Now copy to Docker container:")
print(f"docker cp {config_file} mmgis-mmgis-1:/usr/src/app/{config_file}")
