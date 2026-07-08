# Docker Database Connection Fix

## Problem
MMGIS container fails to start with error:
```
connect ECONNREFUSED 127.0.0.1:54843
```

## Root Cause
The `.env` file is configured for **local development** (localhost database), not **Docker deployment** (Docker service network).

### Local vs Docker Configuration

| Setting | Local Development | Docker Deployment |
|---------|------------------|-------------------|
| `DB_HOST` | `localhost` or `127.0.0.1` | `db` (service name) |
| `DB_PORT` | Custom (e.g., 54843) | `5432` (internal) |
| `DB_USER` | Your local user | `postgres` |
| `DB_PASS` | Your local password | `postgres` |

## Quick Fix

### Option 1: Use the Fix Script (Recommended)
```bash
./fix-docker-db.sh
```

This will:
1. ✅ Backup your current `.env`
2. ✅ Update database settings for Docker
3. ✅ Restart Docker containers
4. ✅ Preserve all other settings (GEMINI_API_KEY, etc.)

### Option 2: Manual Fix

1. **Edit `.env` file** and update these lines:
   ```bash
   DB_HOST=db
   DB_PORT=5432
   DB_NAME=mmgis
   DB_USER=postgres
   DB_PASS=postgres
   ```

2. **Restart Docker containers**:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

3. **Wait ~30 seconds** and check logs:
   ```bash
   docker-compose logs -f mmgis
   ```

## Why This Happens

### Docker Networking
- Docker Compose creates an internal network
- Services communicate via **service names**, not localhost
- The database service is named `db` in `docker-compose.yml`
- Port `5432` is internal to the Docker network

### Port Mapping
```yaml
db:
  ports:
    - 5432  # Internal: 5432, External: random (50035 in this case)
```

- **Internal**: Containers use port `5432`
- **External**: Your host maps to a random high port (e.g., `50035`)
- MMGIS container connects to `db:5432` (internal)
- Your host connects to `localhost:50035` (external)

## Complete Solution: Two .env Files

For easier switching between local and Docker development:

### Strategy 1: Separate Files
```bash
# Create separate configs
cp .env .env.local       # For local development
cp .env .env.docker      # For Docker deployment

# Edit .env.docker:
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres

# Edit .env.local:
DB_HOST=localhost
DB_PORT=54843  # Your local Postgres port
DB_USER=your_user
DB_PASS=your_pass

# Switch between them:
cp .env.docker .env  # Use Docker config
# or
cp .env.local .env   # Use local config
```

### Strategy 2: Script-Based Switching
```bash
# Create a toggle script
cat > toggle-env.sh << 'EOF'
#!/bin/bash
if grep -q "DB_HOST=db" .env; then
    echo "Switching to LOCAL development..."
    sed -i.bak 's/DB_HOST=db/DB_HOST=localhost/' .env
    sed -i.bak 's/DB_PORT=5432/DB_PORT=54843/' .env
else
    echo "Switching to DOCKER development..."
    sed -i.bak 's/DB_HOST=localhost/DB_HOST=db/' .env
    sed -i.bak 's/DB_PORT=54843/DB_PORT=5432/' .env
fi
grep "^DB_" .env
EOF
chmod +x toggle-env.sh
```

## Verification Steps

### 1. Check Database Container
```bash
docker ps | grep db
```
Expected: Container is running and healthy

### 2. Test Database Connection from Container
```bash
docker exec mmgis-mmgis-1 sh -c 'psql -h db -U postgres -d mmgis -c "SELECT version();"'
```
Expected: PostgreSQL version info

### 3. Check Environment Variables
```bash
docker exec mmgis-mmgis-1 sh -c 'echo "DB_HOST=$DB_HOST DB_PORT=$DB_PORT"'
```
Expected: `DB_HOST=db DB_PORT=5432`

### 4. Check MMGIS Logs
```bash
docker-compose logs mmgis | grep -i "database\|connected\|listening"
```
Expected: "Connected to database" and "Server listening on port 8888"

## Troubleshooting

### Issue: "ECONNREFUSED 127.0.0.1"
**Cause**: `.env` has `DB_HOST=localhost` or local IP
**Solution**: Set `DB_HOST=db`

### Issue: "ECONNREFUSED db:54843"
**Cause**: `.env` has local port instead of Docker port
**Solution**: Set `DB_PORT=5432`

### Issue: "password authentication failed"
**Cause**: `.env` has local credentials
**Solution**: Set `DB_USER=postgres` and `DB_PASS=postgres`

### Issue: "database 'name' does not exist"
**Cause**: `.env` has placeholder database name
**Solution**: Set `DB_NAME=mmgis`

### Issue: "Could not connect to server"
**Cause**: Database container isn't ready yet
**Solution**: Wait 30 seconds, check `docker ps`, ensure db is healthy

### Issue: Database container shows "No space left on device"
**Solution**: 
```bash
docker system prune -f
docker volume prune -f
```

## Docker Compose Database Configuration

The `docker-compose.yml` defines the database service:

```yaml
db:
  image: postgis/postgis:16-3.4-alpine
  env_file: .env  # Loads environment variables
  environment:
    - POSTGRES_USER=postgres
    - POSTGRES_PASSWORD=postgres
    - POSTGRES_DB=mmgis
  ports:
    - 5432  # Internal port only
  volumes:
    - mmgis-db:/var/lib/postgresql/data
```

MMGIS connects via:
```javascript
// Inside Docker container
const connection = {
  host: process.env.DB_HOST,    // Must be 'db'
  port: process.env.DB_PORT,    // Must be 5432
  database: process.env.DB_NAME, // mmgis
  user: process.env.DB_USER,    // postgres
  password: process.env.DB_PASS, // postgres
}
```

## Testing After Fix

1. **Start containers**:
   ```bash
   docker-compose up -d
   ```

2. **Watch logs**:
   ```bash
   docker-compose logs -f mmgis
   ```

3. **Look for success messages**:
   ```
   ✅ "Connected to database"
   ✅ "Server listening on port 8888"
   ✅ "MMGIS initialized successfully"
   ```

4. **Test in browser**:
   - Open: http://localhost:8888
   - Should see MMGIS landing page
   - Login and test Copilot: "Highlight areas where SWOT daily freeboard exceeds 0.1m"

## Success Indicators

✅ No database connection errors in logs
✅ MMGIS container status: `healthy`
✅ Web interface accessible at localhost:8888
✅ Can login and access missions
✅ Copilot/AI Agent responds (with GEMINI_API_KEY set)

## Related Issues

This fix resolves:
- ✅ Database connection errors in Docker
- ✅ "ECONNREFUSED" errors on startup
- ✅ Port mismatch issues (54843 vs 5432)
- ✅ Localhost vs service name confusion

After this fix, you may need:
- 🔧 Gemini API key configuration (see `GEMINI-DOCKER-FIX.md`)
- 🔧 Plugin dependencies validation (already fixed: `dependencies: []` → `dependencies: {}`)

## Next Steps

After fixing the database connection:
1. ✅ Fix completed - database connects successfully
2. 🔄 Run `./fix-gemini-docker.sh` to configure AI Agent
3. 🧪 Test SWOT data visualization with Copilot
4. 📊 Explore the operational dashboard features

## Files Created

- `fix-docker-db.sh` - Automated database config fix
- `DOCKER-DB-FIX.md` - This documentation
- `.env.backup-*` - Timestamped backups of your config

## Security Notes

⚠️ **Development credentials**: The default `postgres/postgres` credentials are fine for local Docker development but should be changed for production:

```yaml
db:
  environment:
    - POSTGRES_PASSWORD=strong_random_password_here
```

And update `.env` accordingly.
