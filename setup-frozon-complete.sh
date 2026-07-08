#!/bin/bash
# Complete Frozon mission setup with forecast data

echo "🚀 Complete Frozon Mission Setup"
echo "================================="
echo ""

# Make sure we're using Docker settings
echo "1. Configuring environment..."

# Update key settings in .env
sed -i.tmp 's/^PORT=.*/PORT=8888/' .env
sed -i.tmp 's/^DB_HOST=.*/DB_HOST=db/' .env
sed -i.tmp 's/^DB_USER=.*/DB_USER=postgres/' .env
sed -i.tmp 's/^DB_PASS=.*/DB_PASS=postgres/' .env
sed -i.tmp 's/^DB_NAME=.*/DB_NAME=mmgis/' .env
sed -i.tmp 's/^NODE_ENV=.*/NODE_ENV=production/' .env

# Make sure STAC and aircraft are enabled
if ! grep -q "^WITH_AIRCRAFT=" .env; then
    echo "WITH_AIRCRAFT=true" >> .env
else
    sed -i.tmp 's/^WITH_AIRCRAFT=.*/WITH_AIRCRAFT=true/' .env
fi

# Add OpenSky settings if missing
if ! grep -q "^OPENSKY_BBOX_LAMIN=" .env; then
    cat >> .env << 'EOF'

# OpenSky Aircraft Tracking
OPENSKY_BBOX_LAMIN=66.5
OPENSKY_BBOX_LOMIN=-180
OPENSKY_BBOX_LAMAX=90
OPENSKY_BBOX_LOMAX=180
OPENSKY_POLL_INTERVAL=60000
OPENSKY_TTL_MINUTES=60
AIRCRAFT_HISTORY_DAYS=7
EOF
fi

rm -f .env.tmp

echo "   ✅ Environment configured for Docker"
echo ""

echo "2. Restarting Docker containers..."
docker-compose down
docker-compose up -d

echo ""
echo "⏳ Waiting for containers to be healthy..."
sleep 15

# Wait for MMGIS to be healthy
for i in {1..30}; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' mmgis-mmgis-1 2>/dev/null)
    if [ "$STATUS" = "healthy" ]; then
        echo "✅ MMGIS container healthy"
        break
    fi
    echo "   Waiting for MMGIS... ($i/30)"
    sleep 2
done

echo ""
echo "3. Checking data files..."
PRED_COUNT=$(ls Missions/frozon/Layers/forecast-7day-PRED/*.tif 2>/dev/null | wc -l)
GRND_COUNT=$(ls Missions/frozon/Layers/forecast-7day-GRND/*.tif 2>/dev/null | wc -l)

echo "   Prediction TIFFs: $PRED_COUNT files"
echo "   Ground Truth TIFFs: $GRND_COUNT files"

if [ "$PRED_COUNT" -eq 0 ] || [ "$GRND_COUNT" -eq 0 ]; then
    echo ""
    echo "⚠️  Warning: Forecast data files not found!"
    echo "   Make sure Missions/frozon/Layers/ contains:"
    echo "   - forecast-7day-PRED/ directory with TIF files"
    echo "   - forecast-7day-GRND/ directory with TIF files"
    echo ""
    exit 1
fi

echo ""
echo "4. Ingesting STAC collections..."
echo "   This may take a few minutes..."

# Check if ingest script exists
if [ ! -f "scripts/ingest_stac_forecast.py" ]; then
    echo "   ⚠️  STAC ingest script not found"
    echo "   The forecast layers will need to be loaded manually"
else
    echo "   Running STAC ingest (this will take time)..."
    docker exec mmgis-mmgis-1 bash -c "source ~/.bashrc && micromamba run -n mmgis python scripts/ingest_stac_forecast.py" || {
        echo "   ⚠️  STAC ingest failed or script needs configuration"
        echo "   You may need to manually load the STAC collections"
    }
fi

echo ""
echo "5. Testing endpoints..."

# Test Aircraft
AIRCRAFT_COUNT=$(curl -s http://localhost:8888/api/aircraft/live | jq '.features | length' 2>/dev/null)
if [ -n "$AIRCRAFT_COUNT" ]; then
    echo "   ✅ Aircraft: $AIRCRAFT_COUNT tracked"
else
    echo "   ⚠️  Aircraft: Not responding"
fi

# Test STAC
STAC_COLS=$(curl -s http://localhost:8888/api/stac/collections | jq '.collections | length' 2>/dev/null)
if [ -n "$STAC_COLS" ]; then
    echo "   ✅ STAC: $STAC_COLS collections"
else
    echo "   ⚠️  STAC: Not responding"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Access Mission:"
echo "   http://localhost:8888/?mission=frozon"
echo ""
echo "2. Layers Available:"
echo "   ✅ Land Mask"
echo "   ✅ Aircraft (Live ADS-B)"
echo "   ⚠️  Ice Forecast (if STAC ingest completed)"
echo "   ✅ GIBS imagery layers"
echo ""
echo "3. If forecast layers don't show:"
echo "   - Check STAC collections: curl http://localhost:8888/api/stac/collections"
echo "   - May need to manually ingest: python scripts/ingest_stac_forecast.py"
echo ""
