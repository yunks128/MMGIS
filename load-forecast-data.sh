#!/bin/bash
# Load forecast GeoTIFF data into STAC

echo "📊 Loading Forecast Data into STAC"
echo "==================================="
echo ""

echo "1. Checking data files..."
PRED_COUNT=$(ls Missions/frozon/Layers/forecast-7day-PRED/*.tif 2>/dev/null | wc -l)
GRND_COUNT=$(ls Missions/frozon/Layers/forecast-7day-GRND/*.tif 2>/dev/null | wc -l)

echo "   Prediction TIFFs: $PRED_COUNT files"
echo "   Ground Truth TIFFs: $GRND_COUNT files"

if [ "$PRED_COUNT" -eq 0 ] || [ "$GRND_COUNT" -eq 0 ]; then
    echo ""
    echo "❌ Error: Forecast data files not found!"
    exit 1
fi

echo ""
echo "2. Checking STAC database..."
docker exec mmgis-db-1 psql -U postgres -c "\l" | grep mmgis-stac
if [ $? -ne 0 ]; then
    echo "❌ Error: mmgis-stac database not found!"
    exit 1
fi

echo ""
echo "3. Running STAC ingest..."
echo "   This will take 5-10 minutes for ~1500 files..."
echo ""

# Run the ingest script inside the container
docker exec mmgis-mmgis-1 bash -c "
export PGSTAC_DSN='postgresql://postgres:postgres@db:5432/mmgis-stac'
cd /usr/src/app
source ~/.bashrc
micromamba run -n mmgis python scripts/ingest_stac_forecast.py
"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Ingest complete!"
    echo ""
    echo "4. Verifying collections..."

    STAC_COLS=$(curl -s http://localhost:8888/api/stac/collections | jq '.collections | length' 2>/dev/null)
    echo "   STAC collections: $STAC_COLS"

    if [ "$STAC_COLS" -ge 2 ]; then
        echo ""
        curl -s http://localhost:8888/api/stac/collections | jq '.collections[] | {id, title}'
    fi

    echo ""
    echo "✅ Success! Forecast layers should now be available"
    echo ""
    echo "🌐 Access mission: http://localhost:8888/?mission=frozon_ai_forecast"
    echo ""
    echo "📋 In the mission:"
    echo "   1. Expand 'Ice Forecast' layer"
    echo "   2. Enable 'SFNO Prediction Daily 10 km 2022-2024'"
    echo "   3. Use time controls to see different dates"
else
    echo ""
    echo "❌ Ingest failed!"
    echo "   Check docker logs: docker logs mmgis-mmgis-1"
fi
