#!/bin/bash
# MMGIS Docker Setup Script
# Ensures .env is properly configured for Docker deployment

set -e  # Exit on error

echo "🚀 MMGIS Docker Setup"
echo "===================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found"
    echo "📋 Copying sample.env to .env..."
    cp sample.env .env
    echo "✅ Created .env from sample.env"
    echo ""
fi

# Read current DB settings
DB_HOST=$(grep "^DB_HOST=" .env | cut -d '=' -f2 | tr -d ' ')
DB_USER=$(grep "^DB_USER=" .env | cut -d '=' -f2 | tr -d ' ')
DB_PASS=$(grep "^DB_PASS=" .env | cut -d '=' -f2 | tr -d ' ')
DB_NAME=$(grep "^DB_NAME=" .env | cut -d '=' -f2 | tr -d ' ')

echo "Current .env database configuration:"
echo "  DB_HOST: $DB_HOST"
echo "  DB_USER: $DB_USER"
echo "  DB_PASS: $DB_PASS"
echo "  DB_NAME: $DB_NAME"
echo ""

# Check if settings match Docker defaults
NEEDS_UPDATE=false

if [ "$DB_HOST" != "db" ] || [ "$DB_USER" != "postgres" ] || \
   [ "$DB_PASS" != "postgres" ] || [ "$DB_NAME" != "mmgis" ]; then
    NEEDS_UPDATE=true
fi

if [ "$NEEDS_UPDATE" = true ]; then
    echo "⚠️  Configuration mismatch detected!"
    echo ""
    echo "Docker expects:"
    echo "  DB_HOST: db"
    echo "  DB_USER: postgres"
    echo "  DB_PASS: postgres"
    echo "  DB_NAME: mmgis"
    echo ""

    # Backup .env
    BACKUP_FILE=".env.backup-$(date +%s)"
    cp .env "$BACKUP_FILE"
    echo "📦 Created backup: $BACKUP_FILE"

    # Update .env
    echo "🔧 Updating .env for Docker..."
    sed -i.tmp 's/^DB_HOST=.*/DB_HOST=db/' .env
    sed -i.tmp 's/^DB_USER=.*/DB_USER=postgres/' .env
    sed -i.tmp 's/^DB_PASS=.*/DB_PASS=postgres/' .env
    sed -i.tmp 's/^DB_NAME=.*/DB_NAME=mmgis/' .env
    rm -f .env.tmp

    echo "✅ .env updated for Docker deployment"
    echo ""
fi

# Check for SECRET
SECRET=$(grep "^SECRET=" .env | cut -d '=' -f2 | tr -d ' ')
if [ -z "$SECRET" ] || [ "$SECRET" = "" ]; then
    echo "⚠️  SECRET is not set in .env"
    echo "🔐 Generating random SECRET..."
    NEW_SECRET=$(openssl rand -hex 64)
    sed -i.tmp "s|^SECRET=.*|SECRET=$NEW_SECRET|" .env
    rm -f .env.tmp
    echo "✅ Generated and set SECRET"
    echo ""
fi

echo "✅ Configuration ready for Docker!"
echo ""
echo "Next steps:"
echo "  1. Build and start: docker-compose up -d --build"
echo "  2. Watch logs:      docker logs mmgis-mmgis-1 -f"
echo "  3. Access MMGIS:    http://localhost:8888"
echo ""
echo "To stop: docker-compose down"
echo "To reset database: docker-compose down -v"
