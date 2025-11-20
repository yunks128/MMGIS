# MMGIS with AgentChat Setup Guide

This guide documents the complete procedure to set up MMGIS with AgentChat functionality using the Frozon mission configuration.

## Prerequisites

- macOS with Homebrew installed
- Node.js and npm
- PostgreSQL 16 installed via Homebrew

## Step 1: Fix System Dependencies

### OpenEXR Libraries
```bash
# Create directory structure
sudo mkdir -p /opt/homebrew/opt/openexr/lib

# Create symlinks for OpenEXR 3.3 (from installed 3.4.3)
sudo ln -sf /opt/homebrew/Cellar/openexr/3.4.3/lib/libOpenEXR-3_4.dylib /opt/homebrew/opt/openexr/lib/libOpenEXR-3_3.32.dylib
sudo ln -sf /opt/homebrew/Cellar/openexr/3.4.3/lib/libOpenEXRCore-3_4.dylib /opt/homebrew/opt/openexr/lib/libOpenEXRCore-3_3.32.dylib
sudo ln -sf /opt/homebrew/Cellar/openexr/3.4.3/lib/libOpenEXRUtil-3_4.dylib /opt/homebrew/opt/openexr/lib/libOpenEXRUtil-3_3.32.dylib
```

### imath Libraries
```bash
# Create directory structure
sudo mkdir -p /opt/homebrew/opt/imath/lib

# Create symlinks for imath 3.1 (from installed 3.1.12)
sudo ln -sf /opt/homebrew/Cellar/imath/3.1.12/lib/libImath-3_1.dylib /opt/homebrew/opt/imath/lib/libImath-3_1.29.dylib
```

## Step 2: Database Setup

### Start PostgreSQL
```bash
brew services start postgresql@16
```

### Create Database and User
```bash
# Create database
/opt/homebrew/opt/postgresql@16/bin/createdb mmgis

# Connect and setup user and permissions
/opt/homebrew/opt/postgresql@16/bin/psql -d mmgis -c "
CREATE USER IF NOT EXISTS \"user\" WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE mmgis TO \"user\";
GRANT ALL ON SCHEMA public TO \"user\";
GRANT ALL ON ALL TABLES IN SCHEMA public TO \"user\";
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO \"user\";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO \"user\";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO \"user\";
"

# Add PostGIS extension
/opt/homebrew/opt/postgresql@16/bin/psql -d mmgis -c "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS btree_gist;"
```

## Step 3: Environment Configuration

Ensure the `.env` file contains:
```bash
# Key configuration
FORCE_CONFIG_PATH=Missions/frozon/config.json
DB_NAME=mmgis
DB_USER=user
DB_PASS=password
DB_HOST=localhost
PORT=8889
MAIN_MISSION=frozon
```

## Step 4: Backend API Configuration

The backend config API has been modified to support `FORCE_CONFIG_PATH`. The key modification in `API/Backend/Config/routes/configs.js` includes:

```javascript
// Check if FORCE_CONFIG_PATH is set and load from file
if (process.env.FORCE_CONFIG_PATH) {
  try {
    const configPath = process.env.FORCE_CONFIG_PATH;
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Apply fallback logic for missionFolderName
    if (config.msv && (!config.msv.missionFolderName || config.msv.missionFolderName === "")) {
      config.msv.missionFolderName = config.msv.mission || "";
    }

    // Add tool configs if requested
    if (req.query.full) {
      // ... tool config loading logic
    }
    
    return res.status(200).json({
      status: 'success',
      message: 'Retrieved configuration.',
      mission: req.body.mission,
      config: config
    });
  } catch (err) {
    // ... error handling
  }
}
```

## Step 5: AgentChat Tool Configuration

Ensure AgentChat is properly configured in `Missions/frozon/config.json` tools array:

```json
{
  "name": "AgentChat",
  "icon": "robot-outline",
  "js": "AgentChatTool",
  "separatedTool": true,
  "on": true,
  "variables": {
    "azureAIFoundryAgentId": "asst_PQEZ4BMQrLNyiheB6fH2TmXJ",
    "azureBingConnectionId": "/subscriptions/50204712-4592-47e2-922c-7ca05b52e930/resourceGroups/copilot-dev/providers/Microsoft.Bing/accounts/BingDevResource/connectionSettings/BingSearchConnection"
  }
}
```

## Step 6: Start the Server

```bash
# Method 1: Using environment variables (recommended)
DB_NAME=mmgis DB_USER=user DB_PASS=password FORCE_CONFIG_PATH=Missions/frozon/config.json PORT=8889 node scripts/server.js

# Method 2: Using npm start (if .env is properly configured)
FORCE_CONFIG_PATH=Missions/frozon/config.json npm start
```

## Verification

1. **Server Status**: Look for these log messages:
   ```
   info   Loaded tool: AgentChat from Frozon-MMGIS-Plugin-Tools
   success   MMGIS successfully started! It's listening on port: 8889
   ```

2. **API Test**: Verify AgentChat is loaded:
   ```bash
   curl -s "http://localhost:8889/api/configure/get?mission=frozon&full=true" | jq '.config.tools[] | select(.name == "AgentChat")'
   ```

3. **Browser Access**: Navigate to `http://localhost:8889`
   - Robot icon should be visible
   - AgentChat should be functional with 18 renderer functions

## Expected Functionality

- ✅ All layers load from frozon configuration
- ✅ AgentChat robot icon visible as separated tool
- ✅ Azure AI integration working
- ✅ 18 renderer functions including opacity controls
- ✅ File-based configuration bypasses database

## Troubleshooting

### Sharp Module Errors
- Ensure OpenEXR and imath symlinks are correctly created
- Check library paths match your Homebrew installation versions

### Database Connection Issues
- Verify PostgreSQL is running: `brew services list | grep postgresql`
- Check user permissions in database
- Confirm database name matches environment variables

### AgentChat Not Loading
- Verify tool is in the tools array in `Missions/frozon/config.json`
- Check that `FORCE_CONFIG_PATH` environment variable is set
- Confirm backend API modifications are in place

### Port Conflicts
- Default port is 8889
- Change PORT environment variable if needed
- Check no other services are using the port: `lsof -i :8889`

## File Locations

- **Main Config**: `Missions/frozon/config.json`
- **Environment**: `.env`
- **Backend API**: `API/Backend/Config/routes/configs.js`
- **AgentChat Plugin**: `src/essence/Frozon-MMGIS-Plugin-Tools/AgentChat/`
- **Tool Configs**: `configure/public/toolConfigs.json`

---

**Last Updated**: November 2024
**Server URL**: http://localhost:8889
**Mission**: frozon