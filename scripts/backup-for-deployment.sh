#!/bin/bash
# MMGIS Frozon Deployment Backup Script
# Creates all necessary files for deployment to a new server

set -e

BACKUP_DIR="./deployment-backup-$(date +%Y%m%d_%H%M%S)"
echo "Creating deployment backup in: $BACKUP_DIR"

# Create backup directory structure
mkdir -p "$BACKUP_DIR"/{databases,mission-data,config}

echo "Step 1/5: Backing up databases..."
# Backup main database (configs, users, sessions)
docker exec mmgis-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d name --format=custom --file=/tmp/mmgis-config.dump'
docker cp mmgis-db-1:/tmp/mmgis-config.dump "$BACKUP_DIR/databases/"

# Backup STAC database (metadata)
docker exec mmgis-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d mmgis-stac --format=custom --file=/tmp/mmgis-stac.dump'
docker cp mmgis-db-1:/tmp/mmgis-stac.dump "$BACKUP_DIR/databases/"

# Clean up temp files in container
docker exec mmgis-db-1 rm -f /tmp/mmgis-config.dump /tmp/mmgis-stac.dump

echo "Step 2/5: Packaging mission data..."
# Backup Frozon mission data (1.1 GB)
tar -czf "$BACKUP_DIR/mission-data/frozon-mission-data.tar.gz" Missions/frozon/

echo "Step 3/5: Copying configuration files..."
# Copy configuration files
cp docker-compose.sample.yml "$BACKUP_DIR/config/docker-compose.yml"
cp sample.env "$BACKUP_DIR/config/sample.env"
cp -r adjacent-servers/resources "$BACKUP_DIR/config/" 2>/dev/null || echo "No adjacent-servers/resources found"

# Copy documentation
cp DEPLOYMENT-GUIDE.md "$BACKUP_DIR/" 2>/dev/null || echo "No deployment guide found"
cp docs/frozon-layer-locations.md "$BACKUP_DIR/" 2>/dev/null || echo "No layer locations doc found"
cp CLAUDE.md "$BACKUP_DIR/" 2>/dev/null || true
cp AGENTS.md "$BACKUP_DIR/" 2>/dev/null || true

echo "Step 4/5: Creating deployment manifest..."
cat > "$BACKUP_DIR/MANIFEST.txt" << EOF
MMGIS Frozon Deployment Package
Generated: $(date)
Source Host: $(hostname)

=== Contents ===

databases/
  - mmgis-config.dump   (~44 MB) - Main database with configs, users, sessions
  - mmgis-stac.dump     (~340 KB) - STAC metadata for 2,185 items

mission-data/
  - frozon-mission-data.tar.gz (~1.1 GB) - All TIF files and assets
    * forecast-7day-PRED (728 files, 298 MB)
    * forecast-7day-GRND (729 files, 144 MB)
    * forecast-7day-DIFF (728 files, 198 MB)

config/
  - docker-compose.yml  - Container orchestration
  - sample.env          - Environment template (CREATE NEW .env ON TARGET!)
  - resources/          - TileMatrixSet definitions

=== Deployment Steps ===

1. Extract this package on target server
2. Follow DEPLOYMENT-GUIDE.md step-by-step
3. IMPORTANT: Create new .env with secure credentials (don't copy from source)
4. Update database credentials in docker-compose.yml (3 places)
5. Add network aliases for stac-fastapi and titiler-pgstac
6. Restore databases and start services

=== Database Info ===

Main Database Name: name
STAC Database Name: mmgis-stac
Default User: \$POSTGRES_USER (from .env)

Current Config Version: $(docker exec mmgis-db-1 psql -U user -d name -t -c "SELECT MAX(version) FROM configs WHERE mission='frozon_ai_forecast';" 2>/dev/null || echo "N/A")
Mission: frozon_ai_forecast
Data Range: 2023-01-04 to 2024-12-31

=== Docker Images Required ===

- ghcr.io/nasa-ammos/mmgis:development
- ghcr.io/stac-utils/stac-fastapi-pgstac:5.0.2
- ghcr.io/stac-utils/titiler-pgstac:1.8.0
- postgis/postgis:16-3.4-alpine

=== Network Requirements ===

- stac-fastapi container needs network alias: stac-fastapi
- titiler-pgstac container needs network alias: titiler-pgstac
- Both on network: mmgis_default

=== Minimum Server Requirements ===

- Docker & Docker Compose
- 16GB RAM (12GB for TiTiler + overhead)
- 10GB disk space
- 4+ CPU cores
- Ports: 8888/8889, 8881, 8884

EOF

echo "Step 5/5: Calculating sizes..."
cat >> "$BACKUP_DIR/MANIFEST.txt" << EOF

=== Package Contents ===

EOF

du -sh "$BACKUP_DIR"/* >> "$BACKUP_DIR/MANIFEST.txt"

echo ""
echo "=== Backup Complete ==="
echo "Location: $BACKUP_DIR"
echo ""
echo "Package contents:"
du -sh "$BACKUP_DIR"/*
echo ""
echo "Total size:"
du -sh "$BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Transfer $BACKUP_DIR to target server"
echo "2. Follow DEPLOYMENT-GUIDE.md in the package"
echo ""
echo "Quick transfer command:"
echo "  rsync -avz --progress $BACKUP_DIR/ user@target-server:/opt/mmgis-frozon/"
echo ""
