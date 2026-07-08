# Gemini API Key - Docker Configuration Fix

## Problem
The Copilot/AI Agent feature fails with "Gemini not configured. Missing environment variables: GEMINI_API_KEY" when running in Docker.

## Root Cause
The Docker container needs the `.env` file with `GEMINI_API_KEY` set, and the container must be rebuilt to pick up the environment variable.

## Quick Fix

### Option 1: Use the Fix Script (Recommended)
```bash
./fix-gemini-docker.sh
```

This script will:
1. ✅ Verify `.env` exists
2. ✅ Check if `GEMINI_API_KEY` is set
3. ✅ Optionally enable `WITH_AGENT=true`
4. ✅ Rebuild and restart Docker containers

### Option 2: Manual Fix

1. **Ensure `.env` file exists**:
   ```bash
   cp sample.env .env  # if .env doesn't exist
   ```

2. **Add your Gemini API key to `.env`**:
   ```bash
   # Get your API key from: https://aistudio.google.com/app/apikey
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. **Enable the AI Agent (if not already enabled)**:
   ```bash
   WITH_AGENT=true
   ```

4. **Rebuild and restart Docker containers**:
   ```bash
   docker-compose down
   docker-compose build mmgis
   docker-compose up -d
   ```

5. **Wait for services to start** (~30 seconds):
   ```bash
   docker-compose logs -f mmgis
   ```

6. **Test the application**:
   - Open http://localhost:8888
   - Test the Copilot/AI Agent feature
   - Try: "Highlight areas where SWOT daily freeboard exceeds 0.1m"

## Verification

Check if the environment variable is properly set in the container:
```bash
docker-compose exec mmgis env | grep GEMINI
```

You should see:
```
GEMINI_API_KEY=your_api_key_here
```

## How Docker Uses .env

The `docker-compose.yml` file includes:
```yaml
services:
  mmgis:
    env_file: .env  # ← This line loads all variables from .env
```

This means:
- ✅ All variables in `.env` are automatically passed to the container
- ❌ Changes to `.env` require container restart to take effect
- ❌ Missing `.env` file = missing environment variables

## Troubleshooting

### Issue: "GEMINI_API_KEY not found"
**Solution**: Add the key to `.env` (not just `sample.env`):
```bash
echo "GEMINI_API_KEY=your_key_here" >> .env
```

### Issue: "Container still doesn't see the key"
**Solution**: Rebuild the container:
```bash
docker-compose down
docker-compose build mmgis
docker-compose up -d
```

### Issue: "WITH_AGENT is not enabled"
**Solution**: Add to `.env`:
```bash
WITH_AGENT=true
```

### Issue: "Still getting errors after rebuild"
**Check logs**:
```bash
docker-compose logs mmgis | grep -i gemini
```

**Verify environment inside container**:
```bash
docker-compose exec mmgis env | grep GEMINI
```

## Azure AI Foundry (Alternative)

If you prefer using Azure AI Foundry instead of Gemini, set these in `.env`:
```bash
WITH_AGENT=true
PROJECT_ENDPOINT=your_azure_endpoint
AZURE_AI_FOUNDRY_AGENT_ID=your_agent_id
AZURE_BING_CONNECTION_ID=your_bing_connection_id  # optional
```

Azure takes priority over Gemini when both are configured.

## Environment Variable Priority

The AI Agent plugin checks for LLM providers in this order:
1. **Azure AI Foundry** (if `PROJECT_ENDPOINT` and `AZURE_AI_FOUNDRY_AGENT_ID` are set)
2. **Google Gemini** (if `GEMINI_API_KEY` is set)
3. **Error** (if neither is configured)

## Related Files

- `.env` - Your actual environment configuration (gitignored)
- `sample.env` - Template with all available options
- `docker-compose.yml` - Docker service definitions (line 9: `env_file: .env`)
- `Dockerfile` - Container build instructions
- `docs/pages/Setup/ENVs/ENVs.md` - Full ENV documentation

## Security Notes

⚠️ **Never commit `.env` to git**
- `.env` is in `.gitignore` by design
- API keys should never be in version control
- Use `sample.env` as a template only

✅ **Production deployment**
- Use Docker secrets or environment-specific configuration
- Rotate API keys regularly
- Limit API key permissions to minimum required

## Testing After Fix

1. **Open MMGIS**: http://localhost:8888
2. **Select a mission** with SWOT data (e.g., "Frozon")
3. **Use the Copilot tool** in the toolbar
4. **Test query**: "Highlight areas where SWOT daily freeboard exceeds 0.1m"
5. **Expected result**: The AI Agent processes the query and highlights regions

## Success Indicators

✅ No "GEMINI_API_KEY missing" errors in logs
✅ Copilot tool responds to queries
✅ AI Agent can analyze SWOT data layers
✅ Docker logs show successful Gemini API initialization

## Next Steps

After fixing the Gemini configuration:
1. Test the Copilot feature with SWOT data
2. Explore other AI Agent capabilities
3. Consider adding Azure AI Foundry for production use
4. Review `docs/pages/Setup/ENVs/ENVs.md` for all AI Agent options
