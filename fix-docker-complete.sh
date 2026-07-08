#!/bin/bash
# Complete Docker configuration fix for MMGIS

set -e

echo "========================================"
echo "Complete Docker Configuration Fix"
echo "========================================"

if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    exit 1
fi

echo "Backing up current .env..."
cp .env .env.backup-complete-$(date +%s)

echo ""
echo "Fixing all Docker-related environment variables..."

# 1. Database configuration
if grep -q "^DB_HOST=" .env; then
    sed -i.tmp 's/^DB_HOST=.*/DB_HOST=db/' .env
else
    echo "DB_HOST=db" >> .env
fi

if grep -q "^DB_PORT=" .env; then
    sed -i.tmp 's/^DB_PORT=.*/DB_PORT=5432/' .env
else
    echo "DB_PORT=5432" >> .env
fi

if grep -q "^DB_NAME=" .env; then
    sed -i.tmp 's/^DB_NAME=.*/DB_NAME=mmgis/' .env
else
    echo "DB_NAME=mmgis" >> .env
fi

if grep -q "^DB_USER=" .env; then
    sed -i.tmp 's/^DB_USER=.*/DB_USER=postgres/' .env
else
    echo "DB_USER=postgres" >> .env
fi

if grep -q "^DB_PASS=" .env; then
    sed -i.tmp 's/^DB_PASS=.*/DB_PASS=postgres/' .env
else
    echo "DB_PASS=postgres" >> .env
fi

# 2. Port configuration (Docker uses 8888)
if grep -q "^PORT=" .env; then
    sed -i.tmp 's/^PORT=.*/PORT=8888/' .env
else
    echo "PORT=8888" >> .env
fi

# 3. Generate SECRET if needed
if ! grep -q "^SECRET=.\{24,\}" .env; then
    echo "Generating secure SECRET..."
    SECRET=$(openssl rand -hex 32)
    if grep -q "^SECRET=" .env; then
        sed -i.tmp "s/^SECRET=.*/SECRET=$SECRET/" .env
    else
        echo "SECRET=$SECRET" >> .env
    fi
fi

rm -f .env.tmp

echo ""
echo "✅ Configuration updated:"
echo "   DB_HOST=db"
echo "   DB_PORT=5432"
echo "   DB_NAME=mmgis"
echo "   DB_USER=postgres"
echo "   DB_PASS=postgres"
echo "   PORT=8888"
echo "   SECRET=<64 characters>"
echo ""

echo "Restarting Docker containers..."
docker-compose down
docker-compose up -d

echo ""
echo "✅ Containers restarted"
echo ""
echo "Waiting for services to initialize (30 seconds)..."
sleep 30

echo ""
echo "Checking container status..."
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep mmgis || true

echo ""
echo "Testing connection..."
if curl -f -s http://localhost:8888 > /dev/null; then
    echo "✅ MMGIS is accessible at http://localhost:8888"
else
    echo "⚠️  MMGIS may still be starting. Check logs:"
    echo "   docker-compose logs -f mmgis"
fi

echo ""
echo "========================================"
echo "Configuration complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:8888"
echo "2. Test the Copilot/AI Agent (if GEMINI_API_KEY is set)"
echo "3. Try: 'Highlight areas where SWOT daily freeboard exceeds 0.1m'"
echo ""
