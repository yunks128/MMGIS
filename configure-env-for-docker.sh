#!/bin/bash
# Configure .env for Docker deployment

ENV_FILE="/Users/kyun/Downloads/JPL/MMGIS/.env"

echo "Configuring .env for Docker..."

# Backup
cp "$ENV_FILE" "$ENV_FILE.backup-docker-$(date +%s)"

# Generate a secure SECRET if not present
SECRET=$(openssl rand -hex 32)

# Create minimal required config for Docker
cat > "$ENV_FILE" << EOF
# Server
SERVER=node
PORT=8888
NODE_ENV=production

# Database (Docker internal)
DB_HOST=db
DB_PORT=5432
DB_NAME=mmgis
DB_USER=postgres
DB_PASS=postgres

# Security
SECRET=$SECRET

# Auth
AUTH=off

# Aircraft Tracking
WITH_AIRCRAFT=true
OPENSKY_BBOX_LAMIN=66.5
OPENSKY_BBOX_LOMIN=-180
OPENSKY_BBOX_LAMAX=90
OPENSKY_BBOX_LOMAX=180
OPENSKY_POLL_INTERVAL=60000
OPENSKY_TTL_MINUTES=60
AIRCRAFT_HISTORY_DAYS=7

# Adjacent Services
WITH_STAC=false
WITH_TIPG=false
WITH_TITILER=false
WITH_TITILER_PGSTAC=false
WITH_VELOSERVER=false
EOF

echo "✅ .env configured for Docker deployment"
echo ""
echo "Settings:"
echo "  DB_HOST=db"
echo "  DB_NAME=mmgis"
echo "  WITH_AIRCRAFT=true"
echo "  SECRET=(generated securely)"
echo ""
echo "Now restart containers:"
echo "  docker compose down"
echo "  docker compose up -d"
