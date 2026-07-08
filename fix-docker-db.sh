#!/bin/bash
# Fix database configuration for Docker deployment
# Docker containers need DB_HOST=db (not localhost)

set -e

echo "========================================"
echo "Fixing Docker Database Configuration"
echo "========================================"

if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    exit 1
fi

echo "Backing up current .env..."
cp .env .env.backup-$(date +%s)

echo "Updating database configuration for Docker..."

# Update DB_HOST to 'db' (Docker service name)
if grep -q "^DB_HOST=" .env; then
    sed -i.tmp 's/^DB_HOST=.*/DB_HOST=db/' .env
else
    echo "DB_HOST=db" >> .env
fi

# Ensure DB_PORT is 5432
if grep -q "^DB_PORT=" .env; then
    sed -i.tmp 's/^DB_PORT=.*/DB_PORT=5432/' .env
else
    echo "DB_PORT=5432" >> .env
fi

# Ensure DB_NAME is mmgis (or keep existing if not localhost-specific)
if ! grep -q "^DB_NAME=" .env; then
    echo "DB_NAME=mmgis" >> .env
fi

# Ensure DB_USER is postgres
if grep -q "^DB_USER=" .env; then
    sed -i.tmp 's/^DB_USER=.*/DB_USER=postgres/' .env
else
    echo "DB_USER=postgres" >> .env
fi

# Ensure DB_PASS is postgres
if grep -q "^DB_PASS=" .env; then
    sed -i.tmp 's/^DB_PASS=.*/DB_PASS=postgres/' .env
else
    echo "DB_PASS=postgres" >> .env
fi

rm -f .env.tmp

echo ""
echo "✅ Database configuration updated for Docker:"
echo "   DB_HOST=db"
echo "   DB_PORT=5432"
echo "   DB_USER=postgres"
echo "   DB_PASS=postgres"
echo ""

read -p "Restart Docker containers? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Restarting containers..."
    docker-compose down
    docker-compose up -d

    echo ""
    echo "✅ Containers restarted"
    echo ""
    echo "Wait ~30 seconds for services to initialize, then check:"
    echo "   docker-compose logs -f mmgis"
    echo ""
    echo "Test at: http://localhost:8888"
fi

echo ""
echo "Note: Your .env backup is saved as .env.backup-$(date +%s)"
echo ""
