# MMGIS Frozon Deployment Guide

This guide covers deploying the Frozon MMGIS instance to a new server.

## Overview

The deployment consists of:
- **Docker containers**: 5 services (MMGIS app, STAC API, TiTiler, database, veloserver)
- **Mission data**: 1.1 GB of GeoTIFF files
- **Database**: PostgreSQL with two databases (config + STAC metadata)
- **Configuration**: Environment variables and Docker Compose setup

## Prerequisites on Target Server

1. **Docker & Docker Compose** installed
2. **Minimum 16GB RAM** (TiTiler requires 8-12GB)
3. **10GB disk space** (5GB images + 1.1GB data + 1GB database + overhead)
4. **Open ports**: 8889 (dev) or 8888 (prod), 8881, 8884 (or configure as internal only)
5. **CPU**: 4+ cores recommended for tile rendering

---

## Part 1: Files to Copy

### 1.1 Mission Data (REQUIRED - 1.1 GB)

```bash
# On source server, create tarball
cd /path/to/MMGIS
tar -czf frozon-mission-data.tar.gz Missions/frozon/

# Copy to target server
scp frozon-mission-data.tar.gz user@target-server:/path/to/MMGIS/
```

**What's included**:
- `Missions/frozon/Layers/forecast-7day-PRED/` - 728 TIF files (298 MB)
- `Missions/frozon/Layers/forecast-7day-GRND/` - 729 TIF files (144 MB)
- `Missions/frozon/Layers/forecast-7day-DIFF/` - 728 TIF files (198 MB)
- Other mission assets (GeoJSON, icons, etc.)

### 1.2 Database Dumps (REQUIRED)

```bash
# On source server, create database backups
docker exec mmgis-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d name --format=custom --file=/tmp/mmgis-config.dump'
docker exec mmgis-db-1 sh -c 'pg_dump -U $POSTGRES_USER -d mmgis-stac --format=custom --file=/tmp/mmgis-stac.dump'

# Copy dumps out of container
docker cp mmgis-db-1:/tmp/mmgis-config.dump ./backups/
docker cp mmgis-db-1:/tmp/mmgis-stac.dump ./backups/

# Transfer to target server
scp backups/mmgis-config.dump user@target-server:/path/to/MMGIS/backups/
scp backups/mmgis-stac.dump user@target-server:/path/to/MMGIS/backups/
```

**Database sizes**:
- `mmgis-config.dump` - ~44 MB (mission configs, users, sessions)
- `mmgis-stac.dump` - ~340 KB (STAC metadata for 2,185 items)

### 1.3 Configuration Files (REQUIRED)

```bash
# Copy these files from source to target
- sample.env                    # Template for environment variables
- docker-compose.sample.yml     # Docker Compose configuration
- adjacent-servers/             # TileMatrixSet definitions and proxy configs
```

You'll create a new `.env` file on the target server (don't copy the existing one - secrets should not be transferred).

### 1.4 Optional Files

```bash
- ssl/                          # SSL certificates (if using HTTPS)
- docs/frozon-layer-locations.md  # Documentation
- CLAUDE.md, AGENTS.md          # Project documentation
```

---

## Part 2: Deployment Steps

### Step 1: Prepare Target Server

```bash
# SSH to target server
ssh user@target-server

# Create project directory
mkdir -p /opt/mmgis-frozon
cd /opt/mmgis-frozon

# Create required directories
mkdir -p Missions backups ssl adjacent-servers/resources/tilematrixsets
```

### Step 2: Transfer Files

```bash
# Extract mission data
tar -xzf frozon-mission-data.tar.gz

# Copy adjacent-servers resources
scp -r user@source:/path/to/MMGIS/adjacent-servers/resources/ ./adjacent-servers/

# Copy compose file
scp user@source:/path/to/MMGIS/docker-compose.sample.yml ./docker-compose.yml
```

### Step 3: Configure Environment Variables

```bash
# Create .env file
cp sample.env .env
nano .env
```

**Required settings in `.env`**:

```bash
# Server Settings
SERVER=node
PORT=8888
AUTH=none                        # or 'local' for authentication
NODE_ENV=production              # Use 'production' for deployment
HTTPS=false                      # Set true if using SSL

# Database Settings (IMPORTANT: Change these!)
DB_HOST=db
DB_PORT=5432
DB_NAME=name                     # Main database name
DB_USER=mmgis_user              # Change to secure username
DB_PASS=CHANGE_THIS_PASSWORD    # Change to secure password

# Session Secret (REQUIRED: Generate new secret!)
SECRET=generate_random_64_char_secret_here

# STAC/TiTiler Database (same credentials)
POSTGRES_USER=mmgis_user        # Must match DB_USER
POSTGRES_PASSWORD=CHANGE_THIS_PASSWORD  # Must match DB_PASS

# Optional: Azure/AWS credentials if using
# AZURE_CLIENT_ID=...
# AWS_ACCESS_KEY_ID=...
```

**Generate a secure secret**:
```bash
openssl rand -base64 48
```

### Step 4: Configure Docker Compose

Edit `docker-compose.yml` and update:

```yaml
# Line 39-40 (stac-fastapi)
- POSTGRES_USER=mmgis_user      # Match .env DB_USER
- POSTGRES_PASS=your_password   # Match .env DB_PASS

# Line 78-80 (tipg)
- POSTGRES_USER=mmgis_user
- POSTGRES_PASS=your_password

# Line 178-180 (titiler-pgstac)
- POSTGRES_USER=mmgis_user
- POSTGRES_PASS=your_password

# Line 236 (db)
- POSTGRES_PASSWORD=your_password  # Match .env DB_PASS
```

**CRITICAL: Add network aliases** for STAC sidecars:

```yaml
services:
  stac-fastapi:
    # ... existing config ...
    networks:
      default:
        aliases:
          - stac-fastapi

  titiler-pgstac:
    # ... existing config ...
    networks:
      default:
        aliases:
          - titiler-pgstac
```

### Step 5: Start Database and Restore Data

```bash
# Start only the database first
docker-compose up -d db

# Wait for database to be healthy
docker-compose ps

# Restore main database
docker cp backups/mmgis-config.dump mmgis-db-1:/tmp/
docker exec mmgis-db-1 sh -c 'pg_restore -U $POSTGRES_USER -d name -c /tmp/mmgis-config.dump'

# Restore STAC database (create it first if needed)
docker exec mmgis-db-1 sh -c 'psql -U $POSTGRES_USER -c "CREATE DATABASE \"mmgis-stac\";"'
docker exec mmgis-db-1 sh -c 'psql -U $POSTGRES_USER -d mmgis-stac -c "CREATE EXTENSION IF NOT EXISTS postgis;"'
docker exec mmgis-db-1 sh -c 'psql -U $POSTGRES_USER -d mmgis-stac -c "CREATE SCHEMA IF NOT EXISTS pgstac;"'
docker cp backups/mmgis-stac.dump mmgis-db-1:/tmp/
docker exec mmgis-db-1 sh -c 'pg_restore -U $POSTGRES_USER -d mmgis-stac /tmp/mmgis-stac.dump'
```

### Step 6: Start All Services

```bash
# Start all containers
docker-compose up -d

# Verify all services are running
docker-compose ps

# Expected output:
# mmgis-mmgis-1         Up (healthy)
# mmgis-stac-api        Up
# mmgis-titiler-pgstac  Up
# mmgis-db-1            Up (healthy)
```

### Step 7: Verify Deployment

```bash
# Test MMGIS app
curl http://localhost:8889/api/utils/healthcheck
# Expected: {"status":"ok"}

# Test STAC API
curl http://localhost:8881/collections | jq '.collections[].id'
# Expected: forecast-7day-PRED, forecast-7day-GRND, forecast-7day-DIFF

# Test TiTiler
curl http://localhost:8884/healthz | jq '.database_online'
# Expected: true

# Check logs for errors
docker-compose logs --tail=50 mmgis
docker-compose logs --tail=50 stac-fastapi
docker-compose logs --tail=50 titiler-pgstac
```

### Step 8: Access the Application

Open browser to:
- **Development**: `http://target-server:8889/?mission=frozon_ai_forecast`
- **Production**: `http://target-server:8888/?mission=frozon_ai_forecast`

**Important**: Use the time control to navigate to dates within the data range (2023-01-04 to 2024-12-31).

---

## Part 3: Troubleshooting

### Layers Not Showing

**Problem**: "SFNO Prediction Daily" layer doesn't appear

**Solutions**:
1. **Check date range**: Data only covers 2023-01-04 to 2024-12-31
2. **Verify STAC containers**:
   ```bash
   docker ps | grep -E "(stac|titiler)"
   ```
3. **Check network aliases**:
   ```bash
   docker network inspect mmgis_default | grep -E "(stac-fastapi|titiler-pgstac)"
   ```
   If missing, recreate with aliases:
   ```bash
   docker-compose down
   # Edit docker-compose.yml to add network aliases (see Step 4)
   docker-compose up -d
   ```

### Database Connection Errors

**Problem**: "database does not exist" or "role does not exist"

**Solutions**:
1. Verify `.env` matches `docker-compose.yml` credentials
2. Recreate databases:
   ```bash
   docker exec mmgis-db-1 psql -U $POSTGRES_USER -c "CREATE DATABASE name;"
   docker exec mmgis-db-1 psql -U $POSTGRES_USER -d name -c "CREATE EXTENSION postgis;"
   # Then restore dumps again
   ```

### Out of Memory Errors

**Problem**: TiTiler crashes or slow tile rendering

**Solutions**:
1. Increase Docker memory limit (16GB+ recommended)
2. Reduce `WEB_CONCURRENCY` in docker-compose.yml:
   ```yaml
   titiler-pgstac:
     environment:
       - WEB_CONCURRENCY=1  # Lower if memory constrained
   ```
3. Monitor memory:
   ```bash
   docker stats mmgis-titiler-pgstac
   ```

### Permission Errors on Mission Files

**Problem**: "Permission denied" reading TIF files

**Solutions**:
```bash
# Fix ownership
sudo chown -R 1000:1000 Missions/frozon/

# Fix permissions
chmod -R 755 Missions/frozon/Layers/
```

---

## Part 4: Post-Deployment Tasks

### 4.1 Set Up Backups

```bash
# Create backup script
cat > /opt/mmgis-frozon/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/mmgis-frozon/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup databases
docker exec mmgis-db-1 pg_dump -U $POSTGRES_USER -d name --format=custom > "$BACKUP_DIR/config_$DATE.dump"
docker exec mmgis-db-1 pg_dump -U $POSTGRES_USER -d mmgis-stac --format=custom > "$BACKUP_DIR/stac_$DATE.dump"

# Clean old backups (keep last 7 days)
find "$BACKUP_DIR" -name "*.dump" -mtime +7 -delete
EOF

chmod +x /opt/mmgis-frozon/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line: 0 2 * * * /opt/mmgis-frozon/backup.sh
```

### 4.2 Configure Firewall

```bash
# If using production mode (port 8888)
sudo ufw allow 8888/tcp

# Block internal ports from external access
sudo ufw deny 8881/tcp  # STAC API
sudo ufw deny 8884/tcp  # TiTiler
```

### 4.3 Set Up HTTPS (Production)

```bash
# Generate SSL certificate (Let's Encrypt recommended)
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/mmgis_cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/mmgis_key.pem

# Update .env
HTTPS=true
HTTPS_KEY=ssl/mmgis_key.pem
HTTPS_CERT=ssl/mmgis_cert.pem

# Restart
docker-compose restart mmgis
```

### 4.4 Monitor Logs

```bash
# Follow all logs
docker-compose logs -f

# Check specific service
docker-compose logs -f mmgis

# Save logs to file
docker-compose logs --since 24h > logs_$(date +%Y%m%d).txt
```

---

## Part 5: Updating the Deployment

### Update Mission Data

```bash
# On target server
cd /opt/mmgis-frozon

# Stop containers
docker-compose stop mmgis stac-fastapi titiler-pgstac

# Add new TIF files
cp new_data/*.tif Missions/frozon/Layers/forecast-7day-PRED/

# Re-ingest to STAC (if using ingest script)
# python3 scripts/ingest_stac_forecast.py

# Restart
docker-compose start mmgis stac-fastapi titiler-pgstac
```

### Update Configuration

```bash
# Update via Configure UI (recommended)
# http://target-server:8888/configure

# Or via SQL
docker exec mmgis-db-1 psql -U $POSTGRES_USER -d name
# INSERT new config version...
```

### Update Docker Images

```bash
# Pull latest images
docker-compose pull

# Restart with new images
docker-compose up -d

# Verify versions
docker-compose images
```

---

## Part 6: Minimal Deployment Checklist

- [ ] Copy `Missions/frozon/` directory (1.1 GB)
- [ ] Copy database dumps (`mmgis-config.dump`, `mmgis-stac.dump`)
- [ ] Copy `adjacent-servers/resources/` directory
- [ ] Copy `docker-compose.sample.yml` as `docker-compose.yml`
- [ ] Create `.env` with secure credentials
- [ ] Update database credentials in `docker-compose.yml` (3 places)
- [ ] Add network aliases for STAC sidecars
- [ ] Start database and restore dumps
- [ ] Start all services
- [ ] Verify health endpoints
- [ ] Test mission URL with valid date range
- [ ] Set up backups
- [ ] Configure firewall

---

## Part 7: Alternative: Docker Volume Migration

If both servers can access shared storage, you can migrate the PostgreSQL data volume directly:

```bash
# On source server
docker run --rm -v mmgis_mmgis-db:/data -v $(pwd):/backup alpine tar czf /backup/postgres-data.tar.gz -C /data .

# Transfer to target
scp postgres-data.tar.gz user@target:/opt/mmgis-frozon/

# On target server
docker volume create mmgis_mmgis-db
docker run --rm -v mmgis_mmgis-db:/data -v $(pwd):/backup alpine tar xzf /backup/postgres-data.tar.gz -C /data
```

This method preserves exact database state including users, permissions, and sequences.

---

## Support

For issues:
1. Check logs: `docker-compose logs`
2. Verify network: `docker network inspect mmgis_default`
3. Test endpoints: Health checks in Step 7
4. Review `docs/frozon-layer-locations.md` for data flow

Container images used:
- MMGIS: `ghcr.io/nasa-ammos/mmgis:development`
- STAC API: `ghcr.io/stac-utils/stac-fastapi-pgstac:5.0.2`
- TiTiler: `ghcr.io/stac-utils/titiler-pgstac:1.8.0`
- Database: `postgis/postgis:16-3.4-alpine`
