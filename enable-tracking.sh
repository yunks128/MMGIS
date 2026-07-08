#!/bin/bash
# Enable vessel and aircraft tracking in MMGIS

echo "🚢✈️  Enabling Tracking Services"
echo "================================"
echo ""

# Backup .env
cp .env .env.backup-tracking-$(date +%s)
echo "📦 Created backup of .env"

# Enable aircraft tracking (OpenSky - no API key needed)
echo ""
echo "✈️  Enabling Aircraft Tracking..."
if ! grep -q "^WITH_AIRCRAFT=" .env; then
    echo "WITH_AIRCRAFT=true" >> .env
    echo "   ✅ Added WITH_AIRCRAFT=true"
else
    sed -i.tmp 's/^WITH_AIRCRAFT=.*/WITH_AIRCRAFT=true/' .env
    echo "   ✅ Updated WITH_AIRCRAFT=true"
    rm -f .env.tmp
fi

# Set OpenSky bounding box for Arctic Circle
if ! grep -q "^OPENSKY_BBOX_LAMIN=" .env || grep -q "^OPENSKY_BBOX_LAMIN=$" .env; then
    sed -i.tmp 's/^OPENSKY_BBOX_LAMIN=.*/OPENSKY_BBOX_LAMIN=66.5/' .env
    echo "   ✅ Set Arctic bounding box (66.5°N - 90°N)"
    rm -f .env.tmp
fi

if ! grep -q "^OPENSKY_BBOX_LOMIN=" .env || grep -q "^OPENSKY_BBOX_LOMIN=$" .env; then
    sed -i.tmp 's/^OPENSKY_BBOX_LOMIN=.*/OPENSKY_BBOX_LOMIN=-180/' .env
    rm -f .env.tmp
fi

if ! grep -q "^OPENSKY_BBOX_LAMAX=" .env || grep -q "^OPENSKY_BBOX_LAMAX=$" .env; then
    sed -i.tmp 's/^OPENSKY_BBOX_LAMAX=.*/OPENSKY_BBOX_LAMAX=90/' .env
    rm -f .env.tmp
fi

if ! grep -q "^OPENSKY_BBOX_LOMAX=" .env || grep -q "^OPENSKY_BBOX_LOMAX=$" .env; then
    sed -i.tmp 's/^OPENSKY_BBOX_LOMAX=.*/OPENSKY_BBOX_LOMAX=180/' .env
    rm -f .env.tmp
fi

# Enable vessel tracking (requires AISStream API key)
echo ""
echo "🚢 Vessel Tracking Configuration:"

# Check if AISSTREAM_API_KEY is set
if grep -q "^AISSTREAM_API_KEY=.\+" .env; then
    echo "   ✓ AISSTREAM_API_KEY is already set"
    VESSEL_ENABLED=true
else
    echo "   ⚠️  AISSTREAM_API_KEY is not set"
    echo ""
    echo "   To enable vessel tracking:"
    echo "   1. Get a free API key from https://aisstream.io"
    echo "   2. Add to .env: AISSTREAM_API_KEY=your_key_here"
    echo ""
    echo "   Skipping vessel tracking for now..."
    VESSEL_ENABLED=false
fi

if [ "$VESSEL_ENABLED" = true ]; then
    if ! grep -q "^WITH_VESSELS=" .env; then
        echo "WITH_VESSELS=true" >> .env
        echo "   ✅ Added WITH_VESSELS=true"
    else
        sed -i.tmp 's/^WITH_VESSELS=.*/WITH_VESSELS=true/' .env
        echo "   ✅ Updated WITH_VESSELS=true"
        rm -f .env.tmp
    fi

    # Set Arctic bounding box for AIS
    if ! grep -q "^AISSTREAM_BBOX=" .env || grep -q "^AISSTREAM_BBOX=$" .env; then
        sed -i.tmp 's/^AISSTREAM_BBOX=.*/AISSTREAM_BBOX=-30,55,40,82/' .env
        echo "   ✅ Set Arctic shipping corridor bbox"
        rm -f .env.tmp
    fi
fi

echo ""
echo "🔄 Restarting MMGIS container..."
docker restart mmgis-mmgis-1

echo ""
echo "⏳ Waiting for container to be healthy..."
sleep 5

# Wait for container to be healthy
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
echo "✅ Tracking Services Configuration Complete!"
echo ""
echo "📊 Status:"
echo "   ✅ Aircraft Tracking: ENABLED"
if [ "$VESSEL_ENABLED" = true ]; then
    echo "   ✅ Vessel Tracking: ENABLED"
else
    echo "   ⚠️  Vessel Tracking: DISABLED (no API key)"
fi

echo ""
echo "🌐 Test the layers:"
echo "   http://localhost:8888/?mission=frozon_ai_forecast"
echo ""
echo "💡 In the mission:"
echo "   1. Click the Layers tool (left toolbar)"
echo "   2. Enable 'Aircraft (Live ADS-B)' layer"
if [ "$VESSEL_ENABLED" = true ]; then
    echo "   3. Enable 'Vessels (Live AIS)' layer"
fi
echo "   4. Aircraft/vessels will appear on the map"
echo ""
