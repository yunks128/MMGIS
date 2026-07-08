#!/usr/bin/env python3
"""
Fix STAC forecast layers to use correct asset name 'data' instead of 'asset'
"""

import json
from pathlib import Path

config_file = Path("Missions/frozon_ai_forecast_v38_config.json")

print("Loading mission config...")
with open(config_file, 'r') as f:
    config = json.load(f)

fixed_count = 0

for layer in config.get('layers', []):
    layer_name = layer.get('name', '')
    layer_url = layer.get('url', '')

    # Find forecast layers that use titilerpgstac
    if 'titilerpgstac' in layer_url and 'forecast' in layer_url.lower():
        print(f"Fixing: {layer_name}")
        print(f"  URL: {layer_url}")

        # Replace assets=asset with assets=data
        if 'assets=asset' in layer_url:
            layer['url'] = layer_url.replace('assets=asset', 'assets=data')
            print(f"  ✓ Changed assets=asset to assets=data")
            fixed_count += 1

        # Also fix in legend if it exists
        if 'legend' in layer and isinstance(layer['legend'], dict):
            legend_url = layer['legend'].get('url', '')
            if 'assets=asset' in legend_url:
                layer['legend']['url'] = legend_url.replace('assets=asset', 'assets=data')
                print(f"  ✓ Fixed legend URL")

print(f"\nFixed {fixed_count} layers")

# Write back
print("Writing updated config...")
with open(config_file, 'w') as f:
    json.dump(config, f, indent=2)

print("✅ Done! Forecast layers should now work")
