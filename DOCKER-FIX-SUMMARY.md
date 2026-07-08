# Docker Configuration Fix Summary

## Problem
The MMGIS container was repeatedly restarting with PostgreSQL authentication errors:
```
password authentication failed for user "postgres" (code: 28P01)
```

## Root Cause
The database credentials in `.env` didn't match the PostgreSQL container configuration in `docker-compose.yml`.

## Solution Applied

### 1. Updated `docker-compose.yml`
- Changed STAC services (stac-fastapi, tipg, titiler-pgstac) from placeholder credentials to `postgres/postgres`
- Removed "UPDATE ME" comments that suggested these needed manual configuration

### 2. Updated `sample.env`
- Changed default values to Docker-friendly defaults:
  - `DB_HOST=db` (was `localhost`)
  - `DB_USER=postgres` (was `user`)
  - `DB_PASS=postgres` (was `password`)
  - `DB_NAME=mmgis` (was `name`)
- Added helpful comments distinguishing Docker vs. local development settings

### 3. Updated Documentation
- Updated `docs/pages/Setup/ENVs/ENVs.md` with Docker-specific guidance
- Added notes explaining the difference between Docker and local development configurations

### 4. Created Setup Scripts

#### `docker-setup.sh` (Recommended)
Automated setup script that:
- Checks if `.env` exists (creates from sample if missing)
- Validates database credentials match Docker requirements
- Backs up existing `.env` before changes
- Generates a random SECRET if missing
- Provides next steps for starting Docker

Usage:
```bash
./docker-setup.sh
docker-compose up -d --build
```

#### `quick-fix-docker.sh`
One-command fix that stops containers, updates config, and restarts:
```bash
./quick-fix-docker.sh
```

## Docker Configuration

The standardized Docker configuration uses:

```env
DB_HOST=db              # Docker service name
DB_PORT=5432           # PostgreSQL default
DB_NAME=mmgis          # Main database
DB_USER=postgres       # PostgreSQL superuser
DB_PASS=postgres       # Default password
```

**Note**: For production deployments, change the PostgreSQL password by updating:
1. `docker-compose.yml` → `db` service → `POSTGRES_PASSWORD`
2. `.env` → `DB_PASS`
3. `docker-compose.yml` → All STAC services → `POSTGRES_PASS`

## Files Modified

1. ✅ `docker-compose.yml` - Updated database credentials
2. ✅ `sample.env` - Updated to Docker defaults with comments
3. ✅ `docs/pages/Setup/ENVs/ENVs.md` - Added Docker guidance
4. ✅ `docker-setup.sh` - Created automated setup script
5. ✅ `quick-fix-docker.sh` - Created quick fix script

## Verification

After starting Docker:
```bash
# Check container status
docker-compose ps

# Watch MMGIS logs
docker logs mmgis-mmgis-1 -f

# Wait for "Server started" message
# Then access: http://localhost:8888
```

## Clean Start (if needed)

To completely reset and start fresh:
```bash
# Stop and remove everything including volumes
docker-compose down -v

# Run setup script
./docker-setup.sh

# Start fresh
docker-compose up -d --build
```

## Key Learnings

1. **Docker service names**: In Docker Compose, services reference each other by service name, not `localhost`
2. **Environment consistency**: Database credentials must match across `.env` and `docker-compose.yml`
3. **STAC services**: The three STAC-related services (stac-fastapi, tipg, titiler-pgstac) all need the same database credentials
4. **Volume persistence**: Using `docker-compose down -v` removes the database volume, forcing a clean initialization

## Next Steps

1. Wait for Docker build to complete
2. Verify MMGIS starts successfully
3. Access http://localhost:8888
4. Create a Reference Mission if needed

## Troubleshooting

### If containers still fail:
```bash
# Check all logs
docker-compose logs

# Check specific service
docker logs mmgis-mmgis-1
docker logs mmgis-db-1

# Verify database is healthy
docker-compose ps
```

### If database issues persist:
```bash
# Complete reset
docker-compose down -v
docker system prune -f
docker-compose up -d --build
```
