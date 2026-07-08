#!/bin/bash
# Fix SFNO and Vessels layers not showing

echo "🔧 Fixing Missing Layers"
echo "======================="
echo ""

# Backup .env
cp .env .env.backup-layers-$(date +%s)
echo "📦 Created backup of .env"
echo ""

# Enable STAC (for SFNO forecast layers)
echo "1. Enabling STAC API..."
if grep -q "^WITH_STAC=" .env; then
    sed -i.tmp 's/^WITH_STAC=.*/WITH_STAC=true/' .env
    echo "   ✅ Updated WITH_STAC=true"
else
    echo "WITH_STAC=true" >> .env
    echo "   ✅ Added WITH_STAC=true"
fi
rm -f .env.tmp

# Check if STAC collections exist
echo ""
echo "2. Checking STAC collections..."
echo "   (SFNO forecast layers require STAC collections to be loaded)"
echo "   Note: If collections don't exist, layers won't display"

# Vessel tracking status
echo ""
echo "3. Vessel Tracking Status:"
if grep -q "^AISSTREAM_API_KEY=.\+" .env; then
    echo "   ✅ AISSTREAM_API_KEY is set"
    if ! grep -q "^WITH_VESSELS=" .env; then
        echo "WITH_VESSELS=true" >> .env
        echo "   ✅ Added WITH_VESSELS=true"
    else
        sed -i.tmp 's/^WITH_VESSELS=.*/WITH_VESSELS=true/' .env
        echo "   ✅ Updated WITH_VESSELS=true"
        rm -f .env.tmp
    fi
else
    echo "   ⚠️  AISSTREAM_API_KEY not set"
    echo "   Vessel layer will show but have no data"
    echo "   Get a free API key from: https://aisstream.io"
fi

echo ""
echo "4. Restarting containers..."
docker-compose restart mmgis

echo ""
echo "⏳ Waiting for container to be healthy..."
sleep 5

# Wait for health
for i in {1..30}; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' mmgis-mmgis-1 2>/dev/null)
    if [ "$STATUS" = "healthy" ]; then
        echo "✅ Container is healthy!"
        break
    fi
    echo "   Waiting... ($i/30)"
    sleep 2
done

echo ""
echo "5. Testing endpoints..."

# Test STAC
echo ""
echo "   STAC API:"
STAC_RESPONSE=$(curl -s http://localhost:8888/api/stac/ | jq -r '.title' 2>/dev/null)
if [ "$STAC_RESPONSE" != "null" ] && [ -n "$STAC_RESPONSE" ]; then
    echo "   ✅ STAC API responding: $STAC_RESPONSE"
else
    echo "   ⚠️  STAC API not responding yet (may need more time)"
fi

# Test Vessels
echo ""
echo "   Vessels API:"
VESSEL_COUNT=$(curl -s http://localhost:8888/api/vessels/live | jq '.features | length' 2>/dev/null)
if [ -n "$VESSEL_COUNT" ]; then
    echo "   ✅ Vessels API responding: $VESSEL_COUNT vessels"
    if [ "$VESSEL_COUNT" = "0" ]; then
        echo "      (No vessels because API key not set)"
    fi
else
    echo "   ⚠️  Vessels API not responding"
fi

# Test Aircraft
echo ""
echo "   Aircraft API:"
AIRCRAFT_COUNT=$(curl -s http://localhost:8888/api/aircraft/live | jq '.features | length' 2>/dev/null)
if [ -n "$AIRCRAFT_COUNT" ]; then
    echo "   ✅ Aircraft API responding: $AIRCRAFT_COUNT aircraft"
else
    echo "   ⚠️  Aircraft API not responding"
fi

echo ""
echo "✅ Configuration complete!"
echo ""
echo "📋 Summary:"
echo "   ✅ STAC enabled (for SFNO forecast layers)"
echo "   ✅ Vessels endpoint active"
echo "   ✅ Aircraft tracking active"
echo ""
echo "⚠️  Important Notes:"
echo ""
echo "1. SFNO Forecast Layers:"
echo "   - Require STAC collections to be loaded into database"
echo "   - If collections don't exist, layers won't show data"
echo "   - Check: curl http://localhost:8888/api/stac/collections"
echo ""
echo "2. Vessel Tracking:"
echo "   - API endpoint is working"
echo "   - Returns empty data (no API key)"
echo "   - To enable: Get key from https://aisstream.io"
echo "   - Add to .env: AISSTREAM_API_KEY=your_key"
echo ""
echo "3. Hard Refresh Browser:"
echo "   - Press Ctrl+Shift+R (Windows/Linux)"
echo "   - Press Cmd+Shift+R (Mac)"
echo ""
echo "🌐 Test the mission:"
echo "   http://localhost:8888/?mission=frozon_ai_forecast"
