#!/bin/bash
# Quick Start Script for Aircraft Tracking in Docker

set -e

cd /Users/kyun/Downloads/JPL/MMGIS

echo "=============================================="
echo "🛩️  MMGIS Aircraft Tracking - Docker Startup"
echo "=============================================="
echo ""

# Check if build is complete
if ! docker images | grep -q "mmgis.*latest"; then
    echo "❌ Docker image 'mmgis:latest' not found!"
    echo ""
    echo "The Docker build may still be in progress."
    echo "Check build status with:"
    echo "  ps aux | grep 'docker build'"
    echo ""
    echo "Or manually build:"
    echo "  docker build -t mmgis:latest ."
    echo ""
    exit 1
fi

echo "✅ Docker image found: mmgis:latest"
echo ""

# Check if .env has aircraft config
if ! grep -q "WITH_AIRCRAFT=true" .env 2>/dev/null; then
    echo "⚠️  WARNING: WITH_AIRCRAFT not set to 'true' in .env"
    echo "Aircraft tracking may not be enabled."
    echo ""
fi

# Check if docker-compose.yml exists
if [ ! -f docker-compose.yml ]; then
    echo "❌ docker-compose.yml not found!"
    echo "Creating from sample..."
    cp docker-compose.sample.yml docker-compose.yml
    echo "✅ docker-compose.yml created"
    echo ""
fi

# Stop any running containers
echo "🛑 Stopping existing containers..."
docker compose down 2>/dev/null || true
echo ""

# Start containers
echo "🚀 Starting MMGIS with Aircraft Tracking..."
docker compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check status
echo ""
docker compose ps

echo ""
echo "=============================================="
echo "✅ MMGIS Started!"
echo "=============================================="
echo ""
echo "📍 Access MMGIS at:"
echo "   http://localhost:8888/?mission=frozon"
echo ""
echo "🔍 Check aircraft API:"
echo "   curl http://localhost:8888/api/aircraft/status | jq '.'"
echo ""
echo "📊 View logs:"
echo "   docker compose logs -f mmgis | grep Aircraft"
echo ""
echo "🛠️  Enable aircraft layer:"
echo "   1. Open MMGIS in browser"
echo "   2. Click Layers Tool (left sidebar)"
echo "   3. Enable 'Aircraft (Live ADS-B)' layer"
echo "   4. Wait ~30 seconds for first data poll"
echo "   5. Look for blue circle markers"
echo "   6. Click any aircraft to see details + track"
echo ""
echo "=============================================="
