#!/bin/bash
# Quick fix for Docker PostgreSQL authentication issues

echo "🔧 Quick Docker Fix - Aligning database credentials"
echo ""

# Stop containers
echo "1. Stopping containers..."
docker-compose down -v

# Backup .env
echo "2. Backing up .env..."
cp .env .env.backup-docker-$(date +%s)

# Update .env to match docker-compose.yml defaults
echo "3. Updating .env to use Docker defaults..."
sed -i.tmp 's/^DB_HOST=.*/DB_HOST=db/' .env
sed -i.tmp 's/^DB_USER=.*/DB_USER=postgres/' .env
sed -i.tmp 's/^DB_PASS=.*/DB_PASS=postgres/' .env
sed -i.tmp 's/^DB_NAME=.*/DB_NAME=mmgis/' .env
rm -f .env.tmp

# Update docker-compose.yml STAC services
echo "4. Updating STAC services in docker-compose.yml..."
sed -i.tmp 's/POSTGRES_USER=username/POSTGRES_USER=postgres/g' docker-compose.yml
sed -i.tmp 's/POSTGRES_PASS=password/POSTGRES_PASS=postgres/g' docker-compose.yml
rm -f docker-compose.yml.tmp

echo ""
echo "✅ Configuration updated!"
echo ""
echo "Starting Docker containers..."
docker-compose up -d

echo ""
echo "📊 Watching logs (Ctrl+C to stop)..."
echo "    Wait for 'Server started' message..."
docker logs mmgis-mmgis-1 -f
