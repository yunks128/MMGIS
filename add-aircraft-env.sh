#!/bin/bash
# Add Aircraft Tracking ENV variables to .env

ENV_FILE="/Users/kyun/Downloads/JPL/MMGIS/.env"

# Check if WITH_AIRCRAFT already exists
if grep -q "WITH_AIRCRAFT" "$ENV_FILE" 2>/dev/null; then
    echo "✓ Aircraft ENV variables already exist in .env"
    exit 0
fi

# Append aircraft configuration
cat >> "$ENV_FILE" << 'EOF'


# ─────────────────────────────────────────────────────────────────────────────
# Plugin: Aircraft (OpenSky Network ADS-B)
# Real-time aircraft tracking via OpenSky Network REST API.
# ─────────────────────────────────────────────────────────────────────────────

# Enable aircraft tracking
WITH_AIRCRAFT=true

# OpenSky Network bounding box (Full Arctic Circle by default)
OPENSKY_BBOX_LAMIN=66.5
OPENSKY_BBOX_LOMIN=-180
OPENSKY_BBOX_LAMAX=90
OPENSKY_BBOX_LOMAX=180

# Polling interval in milliseconds (30 seconds)
OPENSKY_POLL_INTERVAL=30000

# In-memory cache TTL (60 minutes)
OPENSKY_TTL_MINUTES=60

# Track history retention (7 days)
AIRCRAFT_HISTORY_DAYS=7
EOF

echo "✅ Aircraft ENV variables added to .env"
echo ""
echo "Configuration:"
echo "  - Coverage: Full Arctic Circle (66.5°N and above)"
echo "  - Update Interval: 30 seconds"
echo "  - Cache TTL: 60 minutes"
echo "  - History: 7 days"
