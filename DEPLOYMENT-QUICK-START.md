# Frozon MMGIS Deployment - Quick Start

## TL;DR - What to Copy

### Required (1.5 GB total):
1. **Missions/frozon/** directory (1.1 GB) - GeoTIFF files
2. **Database dumps** (44 MB + 340 KB) - Configs and metadata
3. **docker-compose.yml** + **sample.env** - Configuration
4. **adjacent-servers/resources/** - TileMatrixSets

### Create Fresh (DON'T copy):
- `.env` file (contains secrets - create new on target)

---

## One-Command Backup

```bash
# Run this on source server
./scripts/backup-for-deployment.sh

# Transfer to target
rsync -avz --progress deployment-backup-*/ user@target:/opt/mmgis-frozon/
```

---

## Five-Step Deployment

### 1. Extract & Configure
```bash
cd /opt/mmgis-frozon
tar -xzf frozon-mission-data.tar.gz
cp sample.env .env
nano .env  # Change DB_USER, DB_PASS, SECRET
```

### 2. Update docker-compose.yml
```yaml
# Add to stac-fastapi and titiler-pgstac services:
networks:
  default:
    aliases:
      - stac-fastapi    # or titiler-pgstac
```

Update credentials in 3 places: stac-fastapi, tipg, titiler-pgstac

### 3. Start Database & Restore
```bash
docker-compose up -d db
docker cp mmgis-config.dump mmgis-db-1:/tmp/
docker exec mmgis-db-1 pg_restore -U user -d name /tmp/mmgis-config.dump
docker cp mmgis-stac.dump mmgis-db-1:/tmp/
docker exec mmgis-db-1 pg_restore -U user -d mmgis-stac /tmp/mmgis-stac.dump
```

### 4. Start All Services
```bash
docker-compose up -d
docker-compose ps  # Verify all healthy
```

### 5. Verify
```bash
curl http://localhost:8889/api/utils/healthcheck
curl http://localhost:8881/collections | jq '.collections[].id'
curl http://localhost:8884/healthz | jq
```

Open: `http://server:8889/?mission=frozon_ai_forecast`

**Use date picker** to select date between 2023-01-04 and 2024-12-31

---

## Troubleshooting

### Layers not showing?
```bash
# Check STAC containers running
docker ps | grep stac

# Check network aliases
docker inspect mmgis-stac-api | grep Aliases

# Restart if needed
docker-compose restart mmgis
```

### Database errors?
```bash
# Verify credentials match between .env and docker-compose.yml
grep -E "DB_USER|DB_PASS" .env
docker-compose config | grep -E "POSTGRES_USER|POSTGRES_PASS"
```

### Out of memory?
```bash
# Check TiTiler memory
docker stats mmgis-titiler-pgstac

# Reduce concurrency in docker-compose.yml:
# WEB_CONCURRENCY=1
```

---

## Critical Points

✅ **DO**:
- Create NEW .env with secure credentials
- Add network aliases for stac-fastapi and titiler-pgstac
- Test with dates in 2023-2024 range
- Set up database backups (cron)

❌ **DON'T**:
- Copy .env from source (contains secrets)
- Forget to match DB credentials in 3 places
- Expect data for 2026 dates (data ends 2024-12-31)
- Skip hard refresh after first load (Cmd+Shift+R)

---

## Files Checklist

Source → Target:
```
Missions/frozon/                   → /opt/mmgis-frozon/Missions/frozon/
databases/mmgis-config.dump        → /opt/mmgis-frozon/backups/
databases/mmgis-stac.dump          → /opt/mmgis-frozon/backups/
config/docker-compose.yml          → /opt/mmgis-frozon/docker-compose.yml
config/sample.env                  → /opt/mmgis-frozon/sample.env
config/resources/                  → /opt/mmgis-frozon/adjacent-servers/resources/
DEPLOYMENT-GUIDE.md                → /opt/mmgis-frozon/
```

---

## Ports Used

| Port | Service | Public? |
|------|---------|---------|
| 8888 | MMGIS (prod) | Yes |
| 8889 | MMGIS (dev) | Yes |
| 8881 | STAC API | Internal only |
| 8884 | TiTiler | Internal only |
| 5432 | PostgreSQL | Internal only |

Configure firewall to only expose 8888 or 8889.

---

## Next Steps After Deployment

1. **Test the mission**: Navigate to valid dates, verify tiles load
2. **Set up backups**: Daily cron for database dumps
3. **Enable HTTPS**: Use Let's Encrypt + update .env
4. **Monitor logs**: `docker-compose logs -f`
5. **Configure authentication**: Set AUTH=local in .env if needed

---

For detailed instructions, see **DEPLOYMENT-GUIDE.md**
